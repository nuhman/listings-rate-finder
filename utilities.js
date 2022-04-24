const getVariableValueFromText = (target, variable, endString = ';', appendString = '') => {
    const chopFront = target.substring(target.search(variable) + variable.length, target.length);
    return chopFront.substring(0, chopFront.search(endString)) + appendString;
}

const getDaysArray = (start, end, rangeLength = 365) => {
    const arr = [];
    const today = (new Date()).toDateString();
    let pastToday = false;
    let pastTodayIndex = 0;
    let loopIndex = 0;

    for(let dt = new Date(start); dt <= new Date(end); dt.setDate(dt.getDate()+1)) {
        if (!pastToday && today == dt.toDateString()) {
            pastToday = true;
            pastTodayIndex = loopIndex;
        } 
        if (pastToday) arr.push(new Date(dt));
        loopIndex += 1;
    }
    return {
        days: arr.map(v => formatDate(v)).slice(0, rangeLength),
        pastTodayIndex,
    };
};

const getMaxElements = (arr, count = 3) => {
    
    if (arr.length <= count) return arr;

    let max = [
        { value: arr[0], index: 0 },
        { value: arr[1], index: 1 },
        { value: arr[2], index: 2 }
    ];
    max.sort((a,b) => a.value - b.value);
        
    for (let i = 3; i < arr.length; i++) {
        if (arr[i] > max[0].value){
           max[0] = { value: arr[i], index: i };
           max.sort((a,b) => a.value - b.value);
        }
    }
    return max;
}

const formatDate = (dt) => {
    return dt.toDateString().split(' ').slice(1).join(' ');
} 

const getFormattedLocation = (location) => {
    if (!location) return '';
    return location.replace(/[,\s]+|[,\s]+/g, '-').toLowerCase();
}

const getLocationFromResponse = (data, searchLocation) => {
    if (!data) return null;
    const { suggestions } = data;
    if (!suggestions || suggestions.length <= 0) return getFormattedLocation(searchLocation);
    const priorityLocations = suggestions.filter(sg => !(sg?.place?.types?.includes("POINT_OF_INTEREST")));
    if (!priorityLocations || priorityLocations.length <= 0) {
        return getFormattedLocation(suggestions[0]?.place?.fullName);
    }
    return getFormattedLocation(priorityLocations[0]?.place?.fullName);
}

const findDaysInMonth = (monthIndex) => {
    return [monthIndex];
}

const getDaysRange = () => {
    const today = new Date();
    const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][today.getMonth()];
    return 366 + Math.abs(today.getDate() - monthDays);
}

module.exports = {
    getVariableValueFromText,
    getDaysArray,
    getMaxElements,
    getLocationFromResponse,
    getDaysRange,
};
