var util = require('util');

var uPnP = require('../index');
//var uPnpDevice = uPnP.Device;
var uPnpRootDevice = uPnP.RootDevice;


var testDevice = new uPnpRootDevice('blank', {headers:{ location:'http://127.0.0.1/test/upnp/52323/dmr.xml'} });


testDevice.fetchServices()
	.then(
		function(actions){
			//console.log('services', util.inspect(actions, {showHidden: true, depth: 12}) );
			console.log('got actions, now invoking', testDevice.services[0]);

			// ListPresets uses argument `InstanceID` of state variable `A_ARG_TYPE_InstanceID`
			// `A_ARG_TYPE_InstanceID` is dataType `ui4`
			testDevice.services[0].invokeAction('ListPresets', {InstanceID:12})
				.then(
					// returns `CurrentPresetNameList`, of state variable `PresetNameList`
					// `PresetNameList` is dataType `string`
					function(response){
						console.log('IDK what response is to look like, pdf page ???', response);
					},
					function(err){
						console.error('error invoking action ListPresets', err);
					}
				);
		},
		function(err){
			console.error('error getting actions', err);
		}
	);
