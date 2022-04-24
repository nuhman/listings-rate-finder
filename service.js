const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const axios = require('axios');
const cheerio = require('cheerio');
const { getVrboListingsParams } = require('./data/queryParams');
const { getVariableValueFromText, getDaysArray, getMaxElements, getLocationFromResponse, getDaysRange } = require('./utilities');

const BASE_DOMAIN = 'https://www.vrbo.com';
const TOTAL_LISTING_PAD = 10;

const getSingleListingData = async (url) => {
    
    try {
        const response = await axios.get(url, {
            headers: {
                Referer: BASE_DOMAIN,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
 
        if (response?.data) {
            // load cheerio with the html response returned
            const $ = cheerio.load(response.data);
            // variable that contains the single listing data in the source
            const DATA_VARIABLE_NAME = 'window.__INITIAL_STATE__ =';

            const scripts = $('script').filter(function() {
                return ($(this).html().indexOf(DATA_VARIABLE_NAME) > -1);
            });
            
            if (scripts.length) {
                const text = $(scripts[0]).html();
                
                // get listing data from the JS variable in the page, and parse it for further use
                let initialState = getVariableValueFromText(text, DATA_VARIABLE_NAME, "};", "}");
                initialState = initialState && JSON.parse(initialState.trim());

                // get Data from the listingReducer
                if (initialState?.listingReducer?.rateSummary) {
                    const {
                        beginDate,
                        endDate,
                        rentNights
                    } = initialState?.listingReducer?.rateSummary;

                    const priceSymbol = initialState?.listingReducer?.priceSummary?.currencySymbol;
                    
                    return {
                        rentNights,
                        beginDate,
                        endDate,
                        priceSymbol,
                    }
                }
            }

        }

        return {
            rentNights: [],
            beginDate: null,
            endDate: null,
            priceSymbol: null,
        }
            
    } catch (e) {
        console.log(e);
        throw Error('Error while getting listing info for url: ', url);
    }
}

exports.getAllListings = async function (count, location) {

    try {

        const headers = { 
            "content-type": "application/json",
        };
        
        const body = getVrboListingsParams(count + TOTAL_LISTING_PAD, location);
        const response = await axios.post(`${BASE_DOMAIN}/serp/g`, body, { headers });

        // continue if results are present in the API response
        if (response?.data?.data?.results) {
            const { resultCount, listings } = response.data.data.results;

            const apiResponse = [];

            if (!listings || listings.length <= 0) {
                return {
                    message: 'Listings array is empty'
                };
            }

            console.log('Total listings count: ', resultCount, '. Fetching first', count, '...');

            // options object for creating CSV file - will add dates to the header array
            let csvPropObject = {
                path: './output/data.csv',
                header: [
                    {id: 'listingId', title: 'Listing Id'},
                    {id: 'unitName', title: 'Property Name'},    
                ]
            };

            let csvWriter;
            const csvData = [];

            
            const daysRangeLength = getDaysRange();
            let finishedCount = 0;
            for(const listing of listings) {

                let dates = [];

                if (finishedCount < count) {
                    const {
                        propertyId,
                        propertyMetadata,
                        detailPageUrl,
                    } = listing;
                    let rentStartIndex = 0;

                    // remove non-ascii characters from property name
                    const unitName = propertyMetadata?.headline && propertyMetadata?.headline.replace(/[^\x00-\x7F]/g, "").trim();

                    const listingReducer = await getSingleListingData(`${BASE_DOMAIN}${detailPageUrl}`);
                    
                    // if there are no dates present in the CSV options header - then add it
                    if (
                        listingReducer?.beginDate && 
                        listingReducer?.endDate &&
                        csvPropObject.header?.length <= 2 // NO dates columns present in the CSV header
                    ) {
                        
                        // get the days array in the form of ['23-04-22', ...], for the range between beginDate & endDate
                        const { days, pastTodayIndex } = getDaysArray(listingReducer?.beginDate, listingReducer?.endDate, daysRangeLength);
                        rentStartIndex = pastTodayIndex;
                        dates = days;

                        // create a new array in the form of [{id: 'day0', title: '23-04-22'},...] for CSV header
                        const daysHeader = (days || []).map((day, i) => {
                            return {
                                id: `day${i}`, title: day,
                            };
                        });

                        // add the created daysHeader array to the CSV header options
                        csvPropObject = {
                            ...csvPropObject,
                            header: [
                                ...csvPropObject.header,
                                ...daysHeader,
                                {id: 'high1', title: 'Highest Price'},
                                {id: 'high2', title: 'Second Highest Price'},
                                {id: 'high3', title: 'Third Highest Price'},
                            ]
                        }

                        // update csvWriter object
                        csvWriter = createCsvWriter(csvPropObject);
                    }

                    const csvDataObject = {
                        listingId: propertyId,
                        unitName,    
                    };

                    // add rent data to CSV data object starting from today upto next 12 months
                    const rents = (listingReducer?.rentNights || []).slice(rentStartIndex, rentStartIndex + daysRangeLength);


                    const rateDateMap = {};
                    rents.forEach((rent, j) => {
                        const key = `day${j}`;
                        if (!(csvDataObject[key])) {
                            csvDataObject[key] = `${listingReducer.priceSymbol}${rent}`;
                        }
                        if (!rateDateMap[dates[j]]) {
                            rateDateMap[dates[j]] = `${listingReducer.priceSymbol}${rent}`;
                        }
                    });

                    // add the current listing data to csvData array
                    if (rents.length) {
                        // get highest 3 prices for the listing
                        const costlyListings = getMaxElements(rents, 3);
                        const csvheaderOffset =  5;

                        csvData.push({
                            ...csvDataObject,
                            high1: `${csvPropObject.header[costlyListings[2].index + csvheaderOffset].title} (${listingReducer.priceSymbol}${costlyListings[2].value})`,
                            high2: `${csvPropObject.header[costlyListings[1].index + csvheaderOffset].title} (${listingReducer.priceSymbol}${costlyListings[1].value})`,
                            high3: `${csvPropObject.header[costlyListings[0].index + csvheaderOffset].title} (${listingReducer.priceSymbol}${costlyListings[0].value})`,
                        });
                    }

                    apiResponse.push({
                        unitName,
                        rateDateMap,
                    });
                    
                    finishedCount += 1;
                    console.log('Fetch Progress: %d%', Math.floor((finishedCount/count)*100));
                }
            };

            // finally write CSV file with the generated data
            csvWriter.writeRecords(csvData)
                .then(() => {
                    console.log('Finished CSV writing...');
                    return { status: 'success-csv' };
                })
                .catch(err => {
                    console.log('Error while writing CSV!', err);
                    return { status: 'error-csv' }
                });
             
            return { status: 'success-getAllListings', data: apiResponse };
        } 

        return { status: 'failure-getAllListings', };
    } catch (e) {
        // Log Errors
        console.log(e);
        throw Error('Error while Getting the Listings');
    }

}

exports.getSuggestedLocation = async function (location) {
    try {

        const headers = { 
            "content-type": "application/json",
        };
        const suggestionURL = `${BASE_DOMAIN}/geo/v2/typeahead/suggest?site=vrbo&size=3&locale=en_US&_restfully=true&input=${encodeURIComponent(location)}`
        const response = await axios.get(`${suggestionURL}`, { headers });
        
        const typedLocation = getLocationFromResponse(response?.data, location);
        return { suggestedLocation: typedLocation };

    } catch (e) {
        console.log(e);
        throw Error('Error while getting location suggestion');
    }
}



