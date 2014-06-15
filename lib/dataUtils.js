module.exports.formatObjectValues = formatObjectValues;

function formatObjectValues(obj){
	Object.keys(obj).forEach(function(key){
		var val = obj[key];
		var valType = typeof val;
		if('object' === valType){
			formatObjectValues(val);
			// <actionList> w/ multiple <action> is originally formatted as
			// {actionList:{ action:[]} }
			// change to {actionList:[]} instead
			if(key.match(/List$/)){
				var valKeys = Object.keys(val);
				if(1 === valKeys.length && 0 === key.indexOf(valKeys[0]) ){
					obj[key] = val[valKeys[0]];
				}
			}
		}else if('string' === valType){
			var maybeNumber = parseFloat(val, 10);
			if(maybeNumber.toString() === val){
				obj[key] = maybeNumber;
			}
		}
	});
	return obj;
}