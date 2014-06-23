var util = require('util');

var uPnP = require('../index');

var cp = new uPnP.ControlPoint();

var serviceOfInterest;
//*
cp
	.on('found', function(device){
		device.fetchDescription().then(function(desc){
			console.log('got description');//, desc);
			device.fetchServices().then(function(services){

				device.invokeAction('Play', {})
					.then(
						function(res){ console.log('play action result', res); },
						function(err){ console.error('play error :(', err); }
					);

				console.log('services', services);
				services.map(Object.keys).forEach(function(keys, index){
					if(keys.indexOf('Play') >= 0){
						serviceOfInterest = services[index];
					}
				});
			});
		});
	})
	.search();
/*/
cp
	.on('found', function(device){
		device.fetchDescription()
			.then(device.fetchServices())
			.then(function(){
				console.log('services', device.serviceList);
			});
	})
	.search();
//*/

function tryPlay(){
	if(!serviceOfInterest){
		return setTimeout(tryPlay, 2000);
	}

	console.log('invoking Action', serviceOfInterest);
	serviceOfInterest.invokeAction('Play', {})
		.then(
			function(res){ console.log('action result', res); },
			function(err){ console.error('error :(', err); }
		);
}
tryPlay();