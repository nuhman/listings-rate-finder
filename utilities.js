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
        days: arr.map(v => v.toISOString().slice(0,10)).slice(0, rangeLength),
        pastTodayIndex,
    };
};

module.exports = {
    getVariableValueFromText,
    getDaysArray,
};
