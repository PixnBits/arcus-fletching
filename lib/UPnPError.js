module.exports = UPnPError;

function UPnPError(message, code){

	if(! this instanceof UPnPError){
		return new UPnPError(message, code);
	}

	// accept xml2obj version of xml UPnPError data
	if('object' === typeof message){
		code = message.code || message.errorCode || code;
		message = message.message || message.errorDescription;
	}

	Error.call(this, message);

	this.message = message;
	this.code = code;
}

UPnPError.prototype = Object.create(Error.prototype);
UPnPError.prototype.constructor = UPnPError;

UPnPError.prototype.name = 'UPnPError';


// Table 3-3 page 89 in UPnP-arch-DeviceArchitecture-v1.1-20081015.pdf
UPnPError.prototype.STATUS_CODES = {
	401: 'Invalid Action', // No action by that name at this service.
	402: 'Invalid Args', // Could be any of the following: not enough in args, args in the wrong order, one or more in args are of the wrong data type.
	//403: '(Do Not Use)', // (This code has been deprecated.)
	501: 'Action Failed', // MAY be returned if current state of service prevents invoking that action.
	600: 'Argument Value Invalid', // The argument value is invalid
	601: 'Argument Value Out of Range', // An argument value is less than the minimum or more than the maximum value of the allowed value range, or is not in the allowed value list.
	602: 'Optional Action Not Implemented', // The requested action is optional and is not implemented by the device.
	603: 'Out of Memory', // The device does not have sufficient memory available to complete the action. This MAY be a temporary condition; the control point MAY choose to retry the unmodified request again later and it MAY succeed if memory is available.
	604: 'Human Intervention Required', // The device has encountered an error condition which it cannot resolve itself and required human intervention such as a reset or power cycle. See the device display or documentation for further guidance.
	605: 'String Argument Too Long', // A string argument is too long for the device to handle properly.
	//606-6124 Reserved These ErrorCodes are reserved for UPnP DeviceSecurity.
	//613-699 TBD Common action errors. Defined by UPnP Forum Technical Committee.
	//700-799 TBD Action-specific errors defined by UPnP Forum working committee.
	//800-899 TBD Action-specific errors for non-standard actions. Defined by UPnP vendor.
};