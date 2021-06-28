export let initCode = `
import sys
import ast
import asyncio
class Tee(object):
    """
    Utility class that imitates a standard python file but writes to two places, stdstream and fileobject
    Based on http://shallowsky.com/blog/programming/python-tee.html
    """
    def __init__(self, stdstream, element):
        """
        :param stdstream: output stream, that gets replaced by the Tee object
        :param fileobject: output file object that needs to be flushed and closed
        """
        self.dom = element
        self.stdstream = stdstream
        self.stdout= stdstream is sys.stdout
        self.stderr= stdstream is sys.stderr
        if not self.stderr and not self.stdout:
            sys.stderr.write("WARNING: It seems that you are nesting experiments. This is untested, but you do you!")
        stdstream = self

    def close(self):
        """Close the file and set the stdstream back to the original stdstream"""
        stdstream = self.stdstream
        if self.stdout:
            sys.stdout = self.stdstream
        if self.stderr:
            sys.stderr = self.stdstream
        self.file.close()

    def __del__(self):
        """Close the file and set the stdstream back to the original stdstream"""
        self.close()
        
    def write(self, data):
        from time import sleep
        """Write to both the output streams and flush"""
        #TODO: we should use inner spans here.
        self.dom.innerText += data
        sleep(1)
        #self.stdstream.write(data)
        self.flush()

    def flush(self):
        """Flush only the file object"""
        pass

    def getvalue(self):
        return self.stdstream.getvalue()


async def _sleep(duration=1):
    await asyncio.sleep(duration)
_SLEEP = ast.parse(r"_sleep(duration=0.5)")
print(ast.dump(_SLEEP))

__ANIMATION_PAUSE__ = 1

def _make_async(m):
    class MakeAsync(ast.NodeTransformer):
        """Find all function definitions and make them async"""
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.func_defs = set()
        def visit_FunctionDef(self, node):
            self.generic_visit(node)
            self.func_defs.add(node.name)
            return ast.AsyncFunctionDef(
                node.name,
                node.args,
                node.body,
                node.decorator_list,
                node.returns,
                node.type_comment
            )

    class CallAsync(ast.NodeTransformer):
        """Find all function calls to freshly-converted async functions with names in func_defs and await the results"""
        def __init__(self, func_defs, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.func_defs = func_defs
        def visit_Call(self, node):
            self.generic_visit(node)
            if isinstance(node.func, ast.Name):
                if node.func.id in self.func_defs:
                    return ast.Await(
                        value=node)
            else:
                print(ast.dump(node), file=sys.stderr)
                return node
    t = MakeAsync()
    m = t.visit(m)
    t = CallAsync(t.func_defs)
    m = t.visit(m)
    return m

test = """
def x(y):
    def _x(y):
        return y ** 2
    _x(y)
    _x(y)
    _x(y)
    return _x(y)
"""

print("MAKE ASYNC TEST")
test = _make_async(ast.parse(test))
print(ast.dump(test))
print(exec(compile(ast.fix_missing_locations(test), filename="<ast>", mode="exec")))



def _register_call_hooks(m, push, pop, animate=True, nono_list=None):

    class FindCalls(ast.NodeVisitor):
        """Finds function calls in m"""
        def __init__(self):
            self.calls = set()
            self.func_defs = set()
        def visit_Call(self, node):
            self.generic_visit(node)
            self.calls.add(node.func.id)
        def visit_FunctionDef(self, node):
            self.generic_visit(node)
            self.func_defs.add(node.name)

    class ReplaceFunctionCalls(ast.NodeTransformer):
        def __init__(self, calls):
            super().__init__()
            self.calls = calls

        def visit_Call(self, node):
            self.generic_visit(node)
            if isinstance(node.func, ast.Name) and node.func.id in self.calls:
                # Return a call to a wrapped function that calls stack.push hook, then call the function, then call stack.pop hook
                return ast.Await(
                        value=ast.Call(
                            func=ast.Name(f"_giftwrapped_{node.func.id}", ctx=node.func.ctx),
                            args=node.args,
                            keywords=node.keywords
                    ))
            return node

    _WRAPPED_CALL="""
async def _giftwrapped_{name}(*args, **kwargs):
    {push}("{name}")
    {animate}
    ret = await {name}(*args, **kwargs)
    {pop}("{name}")
    {animate}
    return ret
    """
    class WrapFunctionDefs(ast.NodeTransformer):
        def __init__(self, func_defs):
            self.func_defs = func_defs
        def visit_FunctionDef(self, node):
            self.generic_visit(node)
            if node.name in self.func_defs:
                new_node = _zeroline(ast.parse(_WRAPPED_CALL.format(
                    name=node.name,
                    push=push.__name__,
                    pop=pop.__name__,
                    animate="await asyncio.sleep(__ANIMATION_PAUSE__)" if animate else "",
                    )
                )).body[0]
                new_node.body[0:0] = [
                    ast.AsyncFunctionDef(
                        node.name,
                        node.args,
                        node.body,
                        node.decorator_list,
                        node.returns,
                        node.type_comment
                    )
                ]
                return new_node
            return node
    def _zeroline(m):
        for n in ast.walk(m):
            n.lineno = 0
            n.col_offset = 0
        return m

    if nono_list is None:
        nono_list = ["range", "list", "print", "Tee"]
    nono_list = set(nono_list)

    #First we find all function calls that we want to animate
    t = FindCalls()
    t.visit(m)
    # we exclude the ones from the no-no-list
    t.calls -= nono_list
    print("Found the following calls:", t.calls, file=sys.stderr)

    # Then we replace all function calls with function calls to the wrapped functions
    m = ReplaceFunctionCalls(t.calls).visit(m)
    # For all "global" functions that need wrapping, we wrapped them directly in the main module
    for call in t.calls:
        #wrap global functions globally
        if call not in t.func_defs:
            print(_WRAPPED_CALL.format(
                    name=call,
                    push=push.__name__,
                    pop=pop.__name__
                    ), file=sys.stderr)
            m.body[0:0] = _zeroline(ast.parse(_WRAPPED_CALL.format(
                    name=call,
                    push=push.__name__,
                    pop=pop.__name__,
                    animate="await asyncio.sleep(__ANIMATION_PAUSE__)" if animate else "",
                    )
                )).body
    # Our own functions get wrapped where they are defined.
    m = WrapFunctionDefs(t.func_defs).visit(m)
    return m

test = """
def x(y):
    return y ** 2
x(5)
__TEST__ = x
"""

test2 = """
def x(y):
    def _x(y):
        return y ** 2
    _x(y)
    print("hallo")
    return _x(y)
__TEST__ = x
"""

print("STACK CALLBACK TEST")
test = _register_call_hooks(ast.parse(test), print, print)
print(ast.dump(test))
#print(exec(compile(ast.fix_missing_locations(test), filename="<ast>", mode="exec")), locals()["__TEST__"])

def process_code(code, wrap=True, animate_prints=False, animate_assignments=False, assignment_callback=None, animate_lines=False, stack_callback=(print, print), lines_callback=None):
    m = ast.parse(code)
    if stack_callback is not None:
        push_callback, pop_callback = stack_callback
        m = _register_call_hooks(m, push_callback, pop_callback)
    # m = _make_async(m)
    if wrap:
        body = m.body
        m.body = [
            ast.AsyncFunctionDef(
                name="___happy_wrapper___",
                args=ast.arguments(
                    posonlyargs=[],
                    args=[],
                    kwonlyargs=[],
                    kw_defaults=[],
                    defaults=[]),
                decorator_list=[],
                body=body
                #TODO: add imports and sysout fixing
            ),
        ]
    # do crazy stuff with m
    print(ast.dump(m), file=sys.stderr)
    code = compile(ast.fix_missing_locations(m), filename="<ast>", mode="exec")
    exec(code)
    return locals()["___happy_wrapper___"]()
#`