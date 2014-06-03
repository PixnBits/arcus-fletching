var uPnpControlPoint = require('../uPnpControlPoint').uPnpControlPoint;

console.log('uPnpControlPoint', uPnpControlPoint);

var server = new uPnpControlPoint();

server.on('found', function(device){
	console.log('found new device!', device);
});

server.on('updated', function(device){
	console.log('device updated', device);
});

server.on('expired', function(device){
	console.log('device expired', device);
});

//server.listen();
server.search();