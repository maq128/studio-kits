// https://developer.chrome.com/apps/about_apps

chrome.app.runtime.onLaunched.addListener(function() {
	chrome.app.window.create('index.html', {
		state: "maximized",
		outerBounds: {
			left: 0,
			top: 0,
			width: 600,
			height: 1000
		}
	});
});
