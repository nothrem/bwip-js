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
 *  A) $('#barcode').bwip(callback); //just pass a function as callback
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
 *  	mode: 'replace',     //defines how the image with barcode is placed in HTML; by default replaces content of the element
 *  							// values are 'append', 'prepend', 'after' and 'before' which uses respective jQuery methods;
 *  							// mode 'none' will not add the image and only pass it into the callback and bwipdone listeners;
 *  	id: 'id-attribute',  //ID attribute of the image element
 *  	classname: 'class',  //CSS class for the image element; always adds class bwipCode
 *  	text: 'string',      //set human-readable text for the barcode or include code if set to True; by default is True
 *  	title: false,        //if true, it will add title attribute for the image
 *  	color: 'transparent',//set background color of the barcode, by default is transparent
 *  	scale: 2,            //set scale of the image as a number or an object with x and y properties, by default is 2
 *      padding: 0,          //set the image padding as a number or an object with x and y properties, by default is 0
 *  };
 *
 *  Option root is required only if you use a loader for the files (e.g. Require.js).
 *  When you include the file directly in HTML as <script src="/path/to/bwip/jquery.bwip.js">
 *  the plugin will automatically detect the folder and use it. Using root option
 *  can also make the first conversion faster if your HTML contains lots of script tags.
 *
 * @copy Nothrem Sinsky (c) 2016
 */
;(function(window, $) {
	var
		//internal reference to BWIP library
		lib = false,
		//options for the Plugin
		opt = {root:'', type:'code128'},
		//Files to load
		files = [
			'lib/fonts.js',
			'lib/filedrop-min.js',
			'freetype.js',
			"bwip.js",
			"lib/canvas.js",
			"lib/symdesc.js"//,
		],
		//private properties
		process,
		//private methods
		getRoot,
		load,
		getScript,
		error;
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
		if (process) {
			return process;
		}
		if (lib) {
			return $.Deferred(function(process) {
				process.resolve(lib);
			});
		}

		return $.Deferred(function(process) {
			process = this;
			$(function() {
				opt.root = opt.root || getRoot();
				window.Module = Module = {
						memoryInitializerPrefixURL: opt.root,
						preRun:[ function() {
								Module.FS_createPreloadedFile('/', "Inconsolata.otf",
										opt.root + "Inconsolata.otf", true, false);
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
							process = null;
							if (!'BWIPJS' in window) {
								process.reject();
								return
							}

							lib = window.BWIPJS;
							lib.load.root = opt.root;
							lib.ft_monochrome(0);
							process.resolve(lib);
						})
						.fail(process.reject)
					; //getScript
				}
			});
		});
	};

	/**
	 * @constructor
	 */
	window.BWIPError = function(message, code) {
		this.name = 'BWIPError';
		this.message = message;
		this.code = code;
	};
	window.BWIPError.prototype = new Error();

	//jQuery methods
	$.bwip = function(options) {
		if (options) {
			for (var i in options) {
				opt[i] = options[i];
			}
		}
		return $;
	}

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

		load().done(function(lib) {
			me.each(function() {
				var
					el = $(this),
					code = el.text(),
					title = el.attr('title'),
					data = el.data('barcode'),
					bwip = new lib(),
					config = {};

				type = type || el.data('barcode-type') || options.type;

				if (data) {
					title = title || code;
					code = data;
				}
				else if ('string' === typeof options.text) {
					title = options.text;
				}

				config.includetext = bwip.value(options.text !== false);
				if (title) {
					config.alttext = bwip.value(title);
				}

				bwip.bitmap(new Bitmap(options.color || 'transparent'));
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

				bwip.push(code);
				bwip.push(config);

				bwip.call(type, function(e) {
					if (e) { //BWIP returns just a string instead of JS Error
						if ('string' === typeof e) {
							e = e.match(/^\[([^]+)][\r\n]*(.*)$/im);
							e = new BWIPError(e[2], e[1]);
						}

						el.trigger('bwiperror', e);
						throw e;
						return; //make sure execution ends
					}

					var
						canvas = document.createElement('canvas'),
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

					bwip.bitmap().show(canvas, 'N');
					image.attr('src', canvas.toDataURL());

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
					el.trigger('bwipdone', image);
				});
			});
		}).fail(function(e) {me.trigger('bwiperror', e)});

		return this;
	}
})(window, window.jQuery);
