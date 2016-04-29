/*
 * jQuery wrapper for BWIP-JS library
 *
 * Use as simple as: $('#barcode').text('Barcode value').bwip({type:'barcode type'});
 *
 * To change options use:
 *  A) $.bwip(options); //set options anytime
 *  B) $('#barcode').bwip(options); //set options and convert element to barcode
 *
 *  To set a callback for the barcode conversion use:
 *  A) $('#barcode').bwip(callback); //just pass a function as callback
 *  B) $('#barcode').bwip({callback:callback}); //change settings and include callback
 *
 *  Available options:
 *  opt = {
 *  	root:'bwip-js/',     //set folder where BWIP-JS files are located on server; by default loads from root
 *  	type:'barcode type'  //change barcode type - see bwipp subfolder for available types; by default uses 'code128'
 *  };
 *
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
		//private methods
		load,
		getScript;
	//var

	//Private methods
	getScript = function(process) {
		var file = opt.root + files.shift();
		$.ajax({url: file, dataType: 'script', cache: true})
			.done(function() {
				console.log('Loaded ', file);
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
		if (lib) {
			return $.Deferred(function(process) {
				process.resolve(lib);
			});
		}

		return $.Deferred(function(process) {
			$(function() {
				window.Module = Module = {
						memoryInitializerPrefixURL: opt.root,
						preRun:[ function() {
								console.log('Preloading font');
								Module.FS_createPreloadedFile('/', "Inconsolata.otf",
										opt.root + "Inconsolata.otf", true, false);
								console.log('Font preloaded');
						} ],
						postRun:[ function() {
							console.log('PostRun');
								var load_font = Module.cwrap("load_font", 'number',
															['string','string','number']);
								load_font(opt.root + "Inconsolata.otf", "INCONSOLATA", 108);
								console.log('Font loading');
						} ]
					};

				if (files.length) {
					$.Deferred(getScript)
						.done(function() {
							console.log('BWIP loaded');
							if (!'BWIPJS' in window) {
								process.reject();
								return
							}

							lib = window.BWIPJS;
							lib.load.root = opt.root;
							lib.ft_monochrome(0);
							process.resolve(lib);
						})
						.fail(function() {
							console.log('Failed');
							console.log(arguments);
							process.reject();
						})
					; //getScript
				}
			});
		});
	};

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
		if (options && !$.isFunction(options)) {
			$.bwip(options);
		}
		var me = this;

		load().done(function(lib) {
			me.each(function() {
				var
					el = $(this),
					code = $(this).text(),
					bwip = new lib();

				bwip.bitmap(new Bitmap());
				bwip.scale(2,2);
				bwip.bitmap().pad(0,0);
				bwip.push(code);
				bwip.push({includetext: true});
				bwip.call(opt.type, function(e) {
					if (e) {
						throw e;
						return;
					}

					var
						canvas = document.createElement('canvas'),
						image = $('<img>');
					el
						.empty()
						.append(image);

					bwip.bitmap().show(canvas, 'N');
					image.attr('src', canvas.toDataURL());

					if ($.isFunction(options)) {
						options.call(el, image);
					}
					else if (options && $.isFunction(options.callback)) {
						options.callback.call(el, image);
					}
				});
			});
		});

		return this;
	}
})(windows, window.jQuery);