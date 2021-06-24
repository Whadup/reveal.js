
/*!
 * reveal.js plugin that adds code editing and local execution
 */
import * as ace from 'brace';
import 'brace/mode/python';
import 'brace/theme/monokai';
import * as initCode from './initpy.js';
function loadScript( url, callback ) {

	let head = document.querySelector( 'head' );
	let script = document.createElement( 'script' );
	script.type = 'text/javascript';
	script.src = url;

	// Wrapper for callback to make sure it only fires once
	let finish = () => {
		if( typeof callback === 'function' ) {
			callback.call();
			callback = null;
		}
	}

	script.onload = finish;

	// IE
	script.onreadystatechange = () => {
		if ( this.readyState === 'loaded' ) {
			finish();
		}
	}

	// Normal browsers
	head.appendChild( script );

}

const Plugin = {

	id: 'python',
	ace: ace,
	initCode: initCode,

	/**
	 * Highlights code blocks withing the given deck.
	 *
	 * Note that this can be called multiple times if
	 * there are multiple presentations on one page.
	 *
	 * @param {Reveal} reveal the reveal.js instance
	 */
	init: function( reveal ) {
		let config = reveal.getConfig().python || {};
		config.highlightOnLoad = typeof config.highlightOnLoad === 'boolean' ? config.highlightOnLoad : true;
		config.escapeHTML = typeof config.escapeHTML === 'boolean' ? config.escapeHTML : true;

		loadScript("https://cdn.jsdelivr.net/pyodide/v0.17.0/full/pyodide.js", 
			async function() 
			{
				await loadPyodide({ indexURL : "https://cdn.jsdelivr.net/pyodide/v0.17.0/full/" });
				console.log(initCode.initCode)
				pyodide.runPython(initCode.initCode);
				//Activate all buttons that trigger python execution.
				Array.from( reveal.getRevealElement().querySelectorAll( 'button.run-python' ) ).forEach( button => {
					button.disabled=false;
					var input = document.getElementById(button.dataset.input);
					var wrap = "wrap" in input.dataset;
					var editor = ace.edit(input);
					var output = document.getElementById(button.dataset.output);
					console.log(output)
					var data = button.getElementsByTagName("data");
					
					var pre = `
from gui import output
sys.stdout = Tee(sys.stdout, output)`;
					var post = "";
					data.forEach(e => {
						if("post" in e.dataset)
							post += e.textContent;
						else
							pre += e.textContent;
					});

					

					button.onclick = async function(e){
						var code = editor.getValue();
						// if(wrap)
						// {
						// 	var lines = code.split('\n');
						// 	code = "async def ___happy_context___():\n";
						// 	lines.forEach((line) => {code += "    " + line + "\n";});
						// 	code += "___happy_context___()\n"
						// }
						//TODO: Animate Assignments
						console.log(pre + "\n" + code + "\n" +  post);
						//Make std-out dom element available for python
						pyodide.registerJsModule("gui", {output: output});

						let wrapped = pyodide.runPythonAsync("process_code(r\"\"\"" + pre + "\n" + code + "\n" +  post + "\"\"\")");
						
						console.log(wrapped);
						// let wrapped = pyodide.globals.get("___happy_context___");
						await wrapped;
						// .then(() => {
						// 	var stdout = pyodide.runPython("sys.stdout.getvalue()");
						// 	output.innerText += "\n" + stdout; 
						// });
					}
				});
			}

		);

		Array.from( reveal.getRevealElement().querySelectorAll( 'pre code' ) ).forEach( block => {

			block.parentNode.className = 'code-wrapper';

			// Code can optionally be wrapped in script template to avoid
			// HTML being parsed by the browser (i.e. when you need to
			// include <, > or & in your code).
			let substitute = block.querySelector( 'script[type="text/template"]' );
			if( substitute ) {
				// textContent handles the HTML entity escapes for us
				block.textContent = substitute.innerHTML;
			}

			// Trim whitespace if the "data-trim" attribute is present
			if( block.hasAttribute( 'data-trim' ) && typeof block.innerHTML.trim === 'function' ) {
				block.innerHTML = betterTrim( block );
			}

			// Escape HTML tags unless the "data-noescape" attrbute is present
			if( config.escapeHTML && !block.hasAttribute( 'data-noescape' )) {
				block.innerHTML = block.innerHTML.replace( /</g,"&lt;").replace(/>/g, '&gt;' );
			}

			// // Re-highlight when focus is lost (for contenteditable code)
			// block.addEventListener( 'focusout', function( event ) {
			// 	hljs.highlightElement( event.currentTarget );
			// }, false );
			console.log(block.classList);
			if( block.classList.contains("python") ) {
				Plugin.highlightBlock( block );
			}

		} );

		// // If we're printing to PDF, scroll the code highlights of
		// // all blocks in the deck into view at once
		// reveal.on( 'pdf-ready', function() {
		// 	[].slice.call( reveal.getRevealElement().querySelectorAll( 'pre code[data-line-numbers].current-fragment' ) ).forEach( function( block ) {
		// 		Plugin.scrollHighlightedLineIntoView( block, {}, true );
		// 	} );
		// } );

	},

	/**
	 * Highlights a code block. If the <code> node has the
	 * 'data-line-numbers' attribute we also generate slide
	 * numbers.
	 *
	 * If the block contains multiple line highlight steps,
	 * we clone the block and create a fragment for each step.
	 */
	highlightBlock: function( block ) {
		console.log(ace);
		const editor = ace.edit(block);
		editor.getSession().setMode('ace/mode/python');
		editor.setTheme('ace/theme/monokai');
		editor.setOptions({
			maxLines: 32,
			minLines: 24,
			fontSize: 16,
			showInvisibles: true,
		});
		function override(object, prop, replacer) { 
			var old = object[prop]; object[prop] = replacer(old)  
		}
		function getZoom(element) {
		   if (!element) return 1;
		   var cs = window.getComputedStyle(element);
		   return cs.zoom * new DOMMatrix(cs.transform).a * getZoom(element.parentElement);
		}
		override(editor.renderer, "screenToTextCoordinates", function(old) {
			return function(x, y) {
				var zoom = getZoom(this.container)
				return old.call(this, x/zoom, y/zoom)
			}
		});
		// editor.commands.on("exec", function(e) { 
		// 	console.log(e);
		// 	var rowCol = editor.selection.getCursor();
		// 	if(e.command.name == "gotoright" || e.command.name == "gotoleft" || e.command.name == "golinedown" || e.command.name == "golineup" || e.command.name == "gotolineend" || e.command.name == "gotolinestart") {

		// 	}
		// 	else if (rowCol.row == 0) {
		// 	  e.preventDefault();
		// 	  e.stopPropagation();
		// 	}
		//   });
	},

	
}


// Function to perform a better "data-trim" on code snippets
// Will slice an indentation amount on each line of the snippet (amount based on the line having the lowest indentation length)
function betterTrim(snippetEl) {
	// Helper functions
	function trimLeft(val) {
		// Adapted from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim#Polyfill
		return val.replace(/^[\s\uFEFF\xA0]+/g, '');
	}
	function trimLineBreaks(input) {
		var lines = input.split('\n');

		// Trim line-breaks from the beginning
		for (var i = 0; i < lines.length; i++) {
			if (lines[i].trim() === '') {
				lines.splice(i--, 1);
			} else break;
		}

		// Trim line-breaks from the end
		for (var i = lines.length-1; i >= 0; i--) {
			if (lines[i].trim() === '') {
				lines.splice(i, 1);
			} else break;
		}

		return lines.join('\n');
	}

	// Main function for betterTrim()
	return (function(snippetEl) {
		var content = trimLineBreaks(snippetEl.innerHTML);
		var lines = content.split('\n');
		// Calculate the minimum amount to remove on each line start of the snippet (can be 0)
		var pad = lines.reduce(function(acc, line) {
			if (line.length > 0 && trimLeft(line).length > 0 && acc > line.length - trimLeft(line).length) {
				return line.length - trimLeft(line).length;
			}
			return acc;
		}, Number.POSITIVE_INFINITY);
		// Slice each line with this amount
		return lines.map(function(line, index) {
			return line.slice(pad);
		})
		.join('\n');
	})(snippetEl);
}

export default () => Plugin;
