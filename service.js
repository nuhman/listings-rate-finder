const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const axios = require('axios');
const cheerio = require('cheerio');
const { getVrboListingsParams } = require('./data/queryParams');
const { getVariableValueFromText, getDaysArray, getMaxElements } = require('./utilities');

const BASE_DOMAIN = 'https://www.vrbo.com';

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
                    
                    return {
                        rentNights,
                        beginDate,
                        endDate,
                    }
                }
            }

        }

        return {
            rentNights: [],
            beginDate: null,
            endDate: null,
        }
            
    } catch (e) {
        console.log(e);
        throw Error('Error while getting listing info for url: ', url);
    }
}

exports.getAllListings = async function (count = 50) {

    try {

        const headers = { 
            "content-type": "application/json",
        };
        
        const body = getVrboListingsParams(count);
        const response = await axios.post(`${BASE_DOMAIN}/serp/g`, body, { headers });

        // continue if results are present in the API response
        if (response?.data?.data?.results) {
            const { resultCount, listings } = response.data.data.results;

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
                    {id: 'high1', title: 'Highest Price'},
                    {id: 'high2', title: 'Second Highest Price'},
                    {id: 'high3', title: 'Third Highest Price'},
                ]
            };

            let csvWriter;
            const csvData = [];

            
            let finishedCount = 0;
            
            for(const listing of listings) {
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
                    csvPropObject.header?.length <= 5 // NO dates columns present in the CSV header
                ) {
                    
                    // get the days array in the form of ['23-04-22', ...], for the range between beginDate & endDate
                    const { days, pastTodayIndex } = getDaysArray(listingReducer?.beginDate, listingReducer?.endDate);
                    rentStartIndex = pastTodayIndex;

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
                        ]
                    }

                    // update csvWriter object
                    csvWriter = createCsvWriter(csvPropObject);
                }

                const csvDataObject = {
                    listingId: propertyId,
                    unitName,    
                };

                // add rent data to CSV data object starting from today upto next 365 days
                const rents = (listingReducer?.rentNights || []).slice(rentStartIndex, rentStartIndex + 365);

                rents.forEach((rent, j) => {
                    const key = `day${j}`;
                    if (!(csvDataObject[key])) {
                        csvDataObject[key] = rent;
                    }
                });

                // add the current listing data to csvData array
                if (rents.length) {
                    // get highest 3 prices for the listing
                    const costlyListings = getMaxElements(rents, 3);
                    const csvheaderOffset =  5;

                    csvData.push({
                        ...csvDataObject,
                        high1: `${costlyListings[2].value} (${csvPropObject.header[costlyListings[2].index + csvheaderOffset].title})`,
                        high2: `${costlyListings[1].value} (${csvPropObject.header[costlyListings[1].index + csvheaderOffset].title})`,
                        high3: `${costlyListings[0].value} (${csvPropObject.header[costlyListings[0].index + csvheaderOffset].title})`,
                    });
                }
                
                finishedCount += 1;
                console.log('Fetch Progress: %d%', Math.floor((finishedCount/count)*100));
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
             
            return { status: 'success-getAllListings', };
        } else {

        }
    } catch (e) {
        // Log Errors
        console.log(e);
        throw Error('Error while Getting the Listings');
    }

}



