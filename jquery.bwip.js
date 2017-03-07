/*
 * jQuery wrapper for BWIP-JS library
 *
 * Use as simple as: $('#barcode').text('Barcode value').bwip({type:'barcode type'});
 *
 * Alternatively you can use HTML attributes to configure the barcode:
 *   $('#barcode')
 *   	.data('barcode', 'Barcode value')
 *   	.data('barcode-type', 'Barcode type')
 *   	.attr('title', 'Human-readable text')
 *   	.bwip({color: 'white', scale: 1, padding:{x:20}})
 *   ;
 *
 * To change default options call the method on jQuery object:
 *  $.bwip({color: 'transparent', scale: 2, title: 'Human-readable text');
 *
 *  To set a callback for the barcode conversion use:
 *  A) $('#barcode').bwip(callback); //just pass a function as callback; this presumes all other values being set using $.bwip() and/or HTML attributes
 *  B) $('#barcode').bwip({callback:callback}); //include the callback in options
 *  C) $.bwip({callback:callback}); //set default callback (not called in A) or B) case)
 *  D) $('#barcode').on('bwipdone', callback); //Use event handler for 'bwipdone' or 'bwiperror'
 *
 *  Note: Event bwipdone gets the resulting image as a second param (first one is the event).
 *  Event bwiperror can get a window.BWIPError if failed in BWIPJS, XHR object if failed
 *  while loading the BWIPJS library from server, or general window.Error in other cases.
 *
 *  Available options:
 *  options = {
 *  	root:'bwip-js/',     //set folder where BWIP-JS files are located on server; by default loads from root or folder where jquery.bwip.js is stored
 *  	type:'barcode type', //change barcode type - see bwipp subfolder for available types; by default uses 'code128'
 *  	eclevel:'M',         //error correction level - size of redundant data to allow reading damaged code; L = 7%, M = 15%, Q = 25%, H = 30%; by default uses 'M'
 *  	mode: 'replace',     //defines how the image with barcode is placed in HTML; by default replaces content of the element
 *  							// values are 'append', 'prepend', 'after' and 'before' which uses respective jQuery methods;
 *  							// mode 'none' will not add the image and only pass it into the callback and bwipdone listeners;
 *  	id: 'id-attribute',  //ID attribute of the image element
 *  	classname: 'class',  //CSS class for the image element; always adds class bwipCode
 *  	text: 'string',      //set human-readable text for the barcode or include code if set to True; by default is True
 *  	title: false,        //if true, it will add title attribute for the image
 *  	color: 'fff',        //set background color of the barcode, give as hexadecimal code, by default is white ('fff')
 *  	scale: 2,            //set scale of the image as a number or an object with x and y properties, by default is 2
 *      padding: 0,          //set the image padding as a number or an object with x and y properties, by default is 0
 *  };
 *
 *  Option root is required only if you use a loader for the files (e.g. Require.js).
 *  When you include the file directly in HTML as <script src="/path/to/bwip/jquery.bwip.js">
 *  the plugin will automatically detect the folder and use it. Using root option
 *  can also make the first conversion faster if your HTML contains lots of script tags.
 *
 *  The $().bwip() method automatically prevents browser from freezing (becoming unresponsive)
 *  while generating multiple codes at the same time. Codes will be generated in sequence
 *  and appended into the page progressively.
 *  If this is unwanted, you can use the cache described below. The method
 *  will trigger event "bwipalldone" on the window when finished.
 *
 *  The $().bwip() method uses cache for already generated codes
 *  (based on code type, code value and options; Options root, mode, id
 *  and classname does not affect the caching).
 *  You can use mode:'none' option to prepare the code in the background
 *  and then displayed it by using other mode or a callback.

	//when all codes are prepared, display them
	$(window).on('bwipalldone', function() {
		$('.__bwip_done').bwip();
	});

	//prepare all codes but do not display them
	$('.bwip-codes').bwip({mode:'none'});
 *
 * @copy Nothrem Sinsky (c) 2016
 */
;(function(window, $) {
	var
		//constants
		PROCESS_LIST_INTERVAL = 1, //1ms beween each code generation
		//internal reference to BWIPJS and BWIPP libraries (can be reused)
		bwipp = false,
		bwipjs = false,
		//options for the Plugin
		opt = {root:'', type:'code128'},
		//Files to load
		files = [
			'freetype.js',
			"bwipp.js",
			"bwipjs.js",
			"lib/bitmap.js",
		],
		//private properties
		mainProcess,
		processList,
		codeCache,
		//private methods
		getRoot,
		load,
		getScript,
		getCode,
		generateCode;
	//var

	//Private methods
	getRoot = function() {
		var root = '', src;
		$('script').each(function() {
			src = $(this).attr('src');
			if (src && (src = src.match(/^(.*\/)jquery\.bwip\.js$/i))) {
				root = src[1];
				return false;
			}
		})
		return root;
	};

	getScript = function(process) {
		var file = opt.root + files.shift();
		$.ajax({url: file, dataType: 'script', cache: true})
			.done(function() {
				if (files.length) {
					getScript(process);
				}
				else {
					process.resolve();
				}
			})
			.fail(process.reject)
		;
	};

	load = function() {
		if (mainProcess) {
			return mainProcess;
		}
		if (bwipjs && bwipp) {
			return $.Deferred(function(process) {
				process.resolve();
			});
		}

		return $.Deferred(function(process) {
			mainProcess = this;
			$(function() {
				opt.root = opt.root || getRoot();
				window.Module = Module = {
						memoryInitializerPrefixURL: opt.root,
						preRun:[ function() {
								Module.FS_createPreloadedFile('/', "Inconsolata.otf",
										opt.root + "fonts/Inconsolata.otf", true, false);
						} ],
						postRun:[ function() {
								var load_font = Module.cwrap("load_font", 'number',
															['string','string','number']);
								load_font("Inconsolata.otf", "INCONSOLATA", 108);
						} ]
					};

				if (files.length) {
					$.Deferred(getScript)
						.done(function() {
							mainProcess = null;
							if (!'BWIPJS' in window) {
								process.reject();
								return;
							}

							bwipjs = window.BWIPJS;
							bwipp = new window.BWIPP();
							process.resolve();
						})
						.fail(process.reject)
					; //getScript
				}
			});
		});
	};

	getCode = function(type, code, options) {
		var json = JSON.stringify(options), process;

		codeCache = codeCache || [];
		codeCache[type] = codeCache[type] || [];
		codeCache[type][code] = codeCache[type][code] || [];
		return codeCache[type][code][json] = codeCache[type][code][json] || $.Deferred(function() {
				var data = {
						process: this,
						type: type,
						code: code,
						options: options
					};

				if (processList) {
					processList.push(data);
					return;
				}

				processList = [data];
				setTimeout(generateCode, PROCESS_LIST_INTERVAL);
			})
		;
	}

	generateCode = function() {
		if (!processList) {
			return;
		}
		var
			data = processList.shift(),
			options = data.options,
			bwip = new bwipjs(window.Module, false);

		bwip.bitmap(new Bitmap(options.color || 'FFF'));
		if (options.scale) {
			if (options.scale.x || options.scale.y) {
				bwip.scale(options.scale.x||2, options.scale.y||2);
			}
			else {
				bwip.scale(options.scale, options.scale);
			}
		}
		else {
			bwip.scale(2, 2);
		}
		if (options.padding) {
			if (options.padding.x || options.padding.y) {
				bwip.bitmap().pad(options.padding.x||0, options.padding.y||0);
			}
			else {
				bwip.bitmap().pad(options.padding, options.padding);
			}
		}
		else {
			bwip.bitmap().pad(0, 0);
		}

		delete options.scale;
		delete options.padding;

		try {
			bwipp(bwip, data.type, data.code, options);
		}
		catch (e) {
			data.process.reject(e);
		}

		var canvas = document.createElement('canvas');
		bwip.bitmap().show(canvas, 'N');
		data.process.resolve(canvas.toDataURL());

		if (processList.length) { //there are more codes to be converted...
			setTimeout(generateCode, PROCESS_LIST_INTERVAL);
		}
		else { //no more codes, stop processing
			processList = false;
			$(window).trigger('bwipalldone');
		}
	};

	//jQuery methods
	$.bwip = function(options) {
		if (options) {
			for (var i in options) {
				opt[i] = options[i];
			}
		}
		return $;
	};

	$.fn.bwip = function(options) {
		if ($.isFunction(options)) {
			options = $.extend({}, opt, {callback: options});
		}
		if (options && options.root) {
			$.bwip({root:options.root});
		}
		var
			me = this,
			type = options ? options.type : undefined;

		options = $.extend({}, opt, options);

		load().done(function() {
			me.not('.__bwip_processing').each(function() {
				var
					el = $(this),
					code = el.text().trim(),
					title = el.attr('title'),
					data = el.data('barcode'),
					config = {};

				el.addClass('__bwip_processing');

				type = type || el.data('barcode-type') || options.type;

				if (data) {
					title = title || code;
					code = data;
				}
				else if ('string' === typeof options.text) {
					title = options.text;
				}

				config.includetext = (options.text !== false);
				if (title) {
					config.alttext = title;
				}

				if (options.eclevel) {
					config.eclevel = options.eclevel;
				}

				config.scale = options.scale;
				config.padding = options.padding;

				getCode(type, code, config)
				.fail(function(e) {
					el.trigger('bwiperror', e);
					throw (e);
				})
				.done(function(code) {
					var
						image = $('<img>');

					image
						.attr('alt', 'code')
						.addClass('bwipCode')
					;
					if (options.id) {
						image.attr('id', options.id);
					}
					if (opt.classname) {
						image.addClass(opt.classname);
					}
					if (options.title) {
						image.attr('title', code);
					}


					image.attr('src', code);

					if ('string' === typeof options.mode) {
						options.mode = options.mode.toLowerCase();
					}
					switch (options.mode) {
						case 'prepend':
							el.prepend(image);
							break;
						case 'append':
							el.append(image);
							break;
						case 'before':
							el.before(image);
							break;
						case 'after':
							el.after(image);
							break;
						case 'none':
							break; //do not add, just trigger the callback
						default:
							el.empty().append(image);
					}


					if ($.isFunction(options.callback)) {
						options.callback.call(el, image);
					}
					el.addClass('__bwip_done').removeClass('__bwip_processing');
					el.trigger('bwipdone', image);
				}); //getCode.done()
			}); //each element from this jquery object
		}).fail(function(e) {me.trigger('bwiperror', e)});

		return this;
	}
})(window, window.jQuery);
