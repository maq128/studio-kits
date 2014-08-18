// https://developer.chrome.com/apps/about_apps

chrome.app.runtime.onLaunched.addListener(function() {
	chrome.app.window.create('index.html', {
		id: 'subtitles-editor'
	});
});
