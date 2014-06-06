var http = require('http');
var url = require('url');
var xml2object = require('xml2object');
var Q = require('q');
//var HTTP = require("q-io/http");
//var EventEmitter = require('events').EventEmitter;

function uPnpDevice(uuid, advertisment){
	this.uuid = uuid;
	this.advertisment = advertisment;
	this.descriptionLocation = advertisment.headers.location;
	//TODO
}

uPnpDevice.prototype.validTo = function(thenSeconds){
	// if thenSeconds is less than a year, interpret as the number of seconds to live from now
	if(thenSeconds < 60*60*24*7*52){
		thenSeconds += Date.now();
	}

	this.expires = thenSeconds;
};

function formatObjectValues(obj){
	Object.keys(obj).forEach(function(key){
		var val = obj[key];
		var valType = typeof val;
		if('object' === valType){
			formatObjectValues(val);
		}else if('string' === valType){
			var maybeNumber = parseFloat(val, 10);
			if(maybeNumber.toString() === val){
				obj[key] = maybeNumber;
			}
		}
	});
	return obj;
}

/**
 * fetchDescription([callback])
 *
 * callback(err [, description])
 **/
uPnpDevice.prototype.fetchDescription = function(callback){
	var self = this,
		descriptionLocation = self.descriptionLocation,
		returnPromise = Q.defer();

	//TODO remove, only for testing (w/o network)
	//location = 'file:///C://Users//nicko_000//Documents//GitHub//arcus-fletching//experiments//dmr.xml';
	//location = 'http://127.0.0.1/test/upnp/dmr.xml';
	//descriptionLocation = self.descriptionLocation = 'http://127.0.0.1/test/upnp/52323/dmr.xml';

	if(!descriptionLocation){
		returnPromise.reject(new Error('No location provided for device description! '+this.uuid));
		return returnPromise.promise;
		//return callback.call(self, new Error('No location provided for device description! '+this.uuid) );
	}


	// parse & store response

	// Create a new xml parser with an array of xml elements to look for
	var parser = new xml2object([ 'root' ]);

	// Bind to the object event to work with the objects found in the XML file
	parser.on('object', function(name, obj) {
		// looking for only 1 object (root) and there should be only 1 in the description
		self.description = formatObjectValues(obj);
		returnPromise.resolve(self.description);
		//callback.call(self, null, self.description);
	});

	// Bind to the file end event to tell when the file is done being streamed
	parser.on('end', function() {
		console.log('Finished parsing xml!');
	});

	// handle bad URLs
	try{
		// pipe an http request into the parser
		// streams decrease memory usage :)
		http.request(descriptionLocation, function(response){
			console.log('got response');
			response.pipe(parser.saxStream);
		}).end(); // we don't need to keep the stream open longer than the parser does

	}catch(e){
		console.error('couldnt make request', e);
		//callback.call(self, e);
		returnPromise.reject(e);
	}

	return returnPromise.promise;
};

//*
uPnpDevice.prototype.fetchServices = function(callback){
	var self = this;
	if(!self.description){
		return self.fetchDescription().then(function(){
			return self.fetchServices();
		});
	}

	// TODO: parse the host from the description location as service SCPD URLs are relative
	var baseUrl = self.descriptionLocation;
	//baseUrl = '127.0.0.1';

	var serviceUrlList = self.description.device.serviceList.service.map(function(service){
			return service.SCPDURL;
		});


	//location = 'file:///C://Users//nicko_000//Documents//GitHub//arcus-fletching//experiments//dmr.xml';
	//location = 'http://127.0.0.1/test/upnp/dmr.xml';
	//descriptionLocation = 'http://127.0.0.1/test/upnp/52323/dmr.xml';

	console.log('serviceUrlList', baseUrl, serviceUrlList);

	self.serviceList = [];
	var responsePromises = [];

	serviceUrlList.forEach(function(serviceUrl, index){

		var servicePromise = Q.defer();
		responsePromises.push(servicePromise.promise);

		// Create a new xml parser with an array of xml elements to look for
		var parser = new xml2object([ 'scpd' ]);

		// Bind to the object event to work with the objects found in the XML file
		parser.on('object', function(name, obj) {
			// looking for only 1 object (root) and there should be only 1 in the description
			self.serviceList[index] = formatObjectValues(obj);
			//callback.call(self, null, self.serviceList, index);
			servicePromise.resolve(obj);
		});

		// Bind to the file end event to tell when the file is done being streamed
		parser.on('end', function() {
			console.log('Finished parsing xml!');
		});

		try{
			// Pipe a http into the parser
			//http.get('http://www.example.com/test.xml').pipe(parser.saxStream);
			http.request(
				url.resolve(baseUrl, serviceUrl),
				function(response){
					console.log('got serviceUrl response', index);
					response.pipe(parser.saxStream);
				}
			).end(); // we don't need to keep the stream open longer than the parser does
		}catch(e){
			console.error('couldnt make request', e);
			callback.call(self, e);
		}
	});

	var allPromise = Q.all(responsePromises);
	console.log('returning allPromise', allPromise);
	return allPromise;

	//*/
};

module.exports = uPnpDevice;