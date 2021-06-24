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

def process_code(code, wrap=True, animate_prints=False, animate_assignments=False, assignment_callback=None, animate_lines=False, stack_callback=None, lines_callback=None):
    m = ast.parse(code)
    body = m.body
    if wrap:
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
            ),
        ]
    # do crazy stuff with m
    code = compile(ast.fix_missing_locations(m), filename="<ast>", mode="exec")
    exec(code)
    return locals()["___happy_wrapper___"]()
#`