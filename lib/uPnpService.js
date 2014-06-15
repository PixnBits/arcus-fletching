var http = require('http');
var url = require('url');
var os = require('os');

var pkgJson = require('../package.json');
var xml2object = require('xml2object');
var Q = require('q');

var UPnPError = require('./UPnPError.js');
var dataUtils = require('./dataUtils.js');

module.exports = uPnpService;


// requires URLs to be pre-formatted (host is usually not part of the URL in the XML)
function uPnpService(opts){ //TODO rename `opts` more descriptive of recieving XML device description object
	var self = this;
	if(! self instanceof uPnpService){
		return new uPnpService(opts);
	}

	opts = self._opts = opts || {};

	// TODO: parsing?
	self.type = opts.type;
	self.id = opts.id;
	self.controlUrl = opts.controlUrl;
	self.eventSubscriberUrl = opts.eventSubscriberUrl;
	self.scpdUrl = opts.scpdUrl;
}

uPnpService.prototype.fetchActions = function(){
	var self = this;

 	var serviceUrl = '/asdf/asdf';

	var scpdDefer = Q.defer();

	// Create a new xml parser with an array of xml elements to look for
	var parser = new xml2object([ 'scpd' ]);

	// Bind to the object event to work with the objects found in the XML file
	parser.on('object', function(name, obj) {
		// looking for only 1 object (root) and there should be only 1 in the description
		self.scpdDescription = dataUtils.formatObjectValues(obj);
		scpdDefer.resolve(obj);
	});

	// Bind to the file end event to tell when the file is done being streamed
	parser.on('end', function() {
		console.log('Finished parsing xml!');
	});

	try{
		// Pipe a http into the parser
		//http.get('http://www.example.com/test.xml').pipe(parser.saxStream);
		http.request(
			self.scpdUrl,
			function(response){
				console.log('got serviceUrl response');
				response.pipe(parser.saxStream);
			}
		).end(); // we don't need to keep the stream open longer than the parser does
	}catch(e){
		console.error('couldnt make request', e);
		scpdDefer.reject(e);
	}

	// actions
	var serviceDefer = Q.defer();

	scpdDefer.promise.then(
		function(scpdDescription){
			console.log('scpdDefer returned!');
			// format to be a bit nicer

			var actions = self.actions = self.actions || {};

			var stateVars = self.stateVars = self.stateVars || {};

			try{

			//console.log('analyzing scpdDescription');//, scpdDescription);

				scpdDescription.serviceStateTable.stateVariable.forEach(function(rawStateVar){
					//console.log('rawStateVar');//, rawStateVar);
					stateVars[rawStateVar.name] = rawStateVar;
				});

			}catch(e){
				console.error('caught error in serviceStateTable', e);
				serviceDefer.reject(e);
			}


			try{

				scpdDescription.actionList.forEach(function(rawAction){
					//TODO
					//console.log('rawAction');//, rawAction);

					var action = actions[rawAction.name] = {
						args:{},
						ret:null,
						affected:{}
					};

					if( rawAction.argumentList && rawAction.argumentList.forEach ){

						rawAction.argumentList.forEach(function(arg){
							if('in' === arg.direction){
								action.args[arg.name] = arg.relatedStateVariable;
							}else if(arg.retval){
								action.ret = arg;
							}else{
								// out, but not a return
								action.affected[arg.name] = arg.relatedStateVariable;
							}
						});
					}

					//console.log('built action');//, action);

				});

			}catch(e){
				console.error('caught error in actionList', e);
				serviceDefer.reject(e);
			}

			//console.log('built actions in rawService');

			console.log('Finished looking at serviceList, built actions');//, actions);

			serviceDefer.resolve(actions);
		},
		function(err){
			//error!
			serviceDefer.reject(err);
		}
	);


	//console.log('returning serviceDefer', serviceDefer.promise);
	return serviceDefer.promise;
};

/*
uPnpDevice.prototype.buildSoapClient = function(){
	var self = this;
	if(!self.serviceList){
		return self.fetchServices().then(function(){
			return self.buildSoapClient();
		});
	}

	var services = self.services = self.services || {};
	self.serviceList.forEach(function(rawService){
		if(! rawService.name){
			console.error('rawService is malformed!', rawService);
			return;
		}

		//build list of arguments


		services[rawService.name] = {
			args: {},
			returns: null
		};
	});

	var d = Q.defer();
	d.resolve(self.services);
	return d.promise;
};//*/

uPnpService.prototype.invokeAction = function(actionName, argObj){
	var d = Q.defer();

	if( ! actionName){
		d.reject(new Error("No action name specified"));
		return d.promise;
	}

	if( ! this.actions){
		console.error('self.actions is falsey', this.actions);
		d.reject(new Error("Must fetch actions before invoking actions"));
		return d.promise;
	}

	if( ! this.actions[actionName]){
		d.reject(new Error("No action '"+actionName+"'"));
		return d.promise;
	}

	//TODO build SOAP XML request
	//TODO send it out via HTTP
	//TODO parse response
	//TODO resolve promise
	//d.reject(new Error('`invokeAction` not implemented yet'));

	//return d.promise;

	try{
		return buildActionSoapRequest(this, actionName, argObj);
	}catch(e){
		console.error('error in buildActionSoapRequest', e);
	}


};



function buildActionSoapRequest(service, actionName, argObj){
	/*
	sample request:

	POST path control URL HTTP/1.0
	HOST: hostname:portNumber
	CONTENT-LENGTH: bytes in body
	CONTENT-TYPE: text/xml; charset="utf-8"
	USER-AGENT: OS/version UPnP/1.1 product/version
	SOAPACTION: "urn:schemas-upnp-org:service:serviceType:v#actionName"
	<?xml version="1.0"?>
	<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
		<s:Body>
			<u:actionName xmlns:u="urn:schemas-upnp-org:service:serviceType:v">
				<argumentName>in arg value</argumentName>
			<!-- other in args and their values go here, if any -->
			</u:actionName>
		</s:Body>
	</s:Envelope>
	*/
	var d = Q.defer();


	// Create a new xml parser with an array of xml elements to look for
	//var parser = new xml2object([ 'Envelope' ], undefined, {xmlns:true});
	var parser = new xml2object([ 'Body' ], undefined, {xmlns:true});

	// Bind to the object event to work with the objects found in the XML file
	parser.on('object', function(name, obj) {
		// looking for only 1 object (Body) for both success and error messages
		if(obj.Fault){
			d.reject(new UPnPError(obj.Fault.detail.UPnPError));
		}else{
			//TODO handle state vars updating?
			d.resolve(obj);
		}
	});

	// Bind to the file end event to tell when the file is done being streamed
	parser.on('end', function() {
		console.log('Finished parsing xml!');
	});


	console.log('creating http request');
	// handle bad URLs
	try{
		var req = http.request(
			{
				method: 'POST',
				/*
				hostname: '127.0.0.1',
				//path: '/test/echo.php',
				//path: '/test/upnpServiceActionResponse.php',
				path: '/test/upnpServiceActionResponse_error.php',
				/*/
				path: service.controlUrl,
				//*/
				headers: {
					'CONTENT-TYPE': 'text/xml; charset="utf-8"',
					'SOAPACTION' : '"urn:schemas-upnp-org:service:'+service.type+'#'+actionName+'"',
					'USER-AGENT': os.platform()+'/'+os.release() + ' UPnP/1.1 ' + pkgJson.name+'/'+pkgJson.version //TODO get version from package.json file
				}
			},
			function(response){
				console.log('got serviceUrl response', response.statusCode);
				//TODO parse XML fun!
				response.pipe(parser.saxStream);
			}
		);

		req.on('error', function(err){
			console.error('error in http request');
			d.reject(err);
		});

		console.log('writing out to request');
		//TODO each req.write is a chunk, while efficient if streaming data, if we have it all here it's likely just harder on the endpoint

		req.write('<?xml version="1.0"?>');
		req.write('<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">');
		req.write(	'<Body>');

		req.write(		'<'+actionName+' xmlns="urn:schemas-upnp-org:service:'+service.type+'">');

		Object.keys(argObj).forEach(function(argName){
			req.write(		'<'+argName+'>'+argObj[argName]+'</'+argName+'>');
		});

		req.write(		'</'+actionName+'>');

		req.write(	'</Body>');
		req.write('</Envelope>');

		req.end(); // we don't need to keep the stream open longer than the parser needs
	}catch(e){
		console.error('couldnt make request', e);
		//callback.call(self, e);
		returnPromise.reject(e);
	}

	return d.promise;
}