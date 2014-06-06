var uPnpControlPoint = require('../uPnpControlPoint');

console.log('uPnpControlPoint', uPnpControlPoint);

var server = new uPnpControlPoint();

/*
server.on('found', function(device){
	console.log('found new device!', device);
	console.log('getting device description', device.uuid, device.fetchDescription().then(
		function(description){
			console.log('success getting device', device.uuid, 'description', description);
		},
		function(error){
			console.error('error getting device', device.uuid, 'error', error);
		}
	));
});
/*/
server.on('found', function(device){
	console.log('found new device!', device);
	console.log('getting device services', device.uuid, device.fetchServices().then(
		function(services){
			console.log('success getting device', device.uuid, 'services', services);
		},
		function(error){
			console.error('error getting device', device.uuid, 'error', error);
		}
	));
});
//*/

server.on('updated', function(device){
	console.log('device updated', device);
});

server.on('expired', function(device){
	console.log('device expired', device);
});

//server.listen();
server.search();