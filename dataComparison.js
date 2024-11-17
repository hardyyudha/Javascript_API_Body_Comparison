const { dir } = require('console')
const fs = require('fs')
const path = require('path')
const dirPath = './dataFetch'
const urlBase = ''
const urlCompare = ''

const endPoint = [""] // Endpoint List

async function login(login_url) {
    const credentials = {
        act: "", // Token generator
        username: "", // Put the Username of urlBase or urlCompaer
        password: "" // Put the Password of urlBase or urlCompare
    }
    try {
        // Send Login request
        const response = await fetch(login_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        })

        if (!response.ok) {
            throw new Error(`Access Login Failed: ${response.status} - ${response.statusText}`)
        }

        const data = await response.json()

        if (data.data.token) {
            return data.data.token
        } else {
            throw new Error('No Token in response')
        }

    } catch (error) {
        console.error('Error during Login: ', error.message)
    }
}

async function getAllData(base_product, token) {
    try {

        const totalActions = endPoint.length
        let processedActions = 0

        for (const action of endPoint) {
            const response = await fetch(base_product, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    "act": action,
                    "token": token,
                    "filter": "",
                    "order": "",
                    "limit": "",
                    "offset": ""
                })
            })

            if (!response.ok) {
                throw new Error(`Failed to fetch data ${action}: ${response.status} - ${response.statusText}`)
            }

            const data = await response.json()

            let fetchData = []
            let fileName

            Object.values(data.data).forEach(dataFetched => {
                fetchData.push(dataFetched)
            })

            if (base_product == urlBase) {
                fileName = `Base`
            } else {
                fileName = `Compared`
            }

            fs.writeFileSync(`./dataFetch/${action}_${fileName}.json`, JSON.stringify(fetchData, null, 2))

            processedActions++
            const percentage = ((processedActions / totalActions) * 100).toFixed(2)
            process.stdout.write(`\rProgress: ${percentage}% (${processedActions} of ${totalActions} ${fileName} actions processed)`); // Print progress on the same line
        }
    } catch (error) {
        console.log(error.message)
    }
}

async function comparingData() {

    const readJsonFile = (fileName) => {
        return JSON.parse(fs.readFileSync(path.join(dirPath, fileName), 'utf-8'))
    }

    const objectsEqual = (obj1, obj2) => {
        return JSON.stringify(obj1) === JSON.stringify(obj2)
    }

    const highlightDifferences = (baseItem, compareItem) => {
        const highlightedObject = {};

        Object.keys(baseItem).forEach(key => {
            if (compareItem.hasOwnProperty(key)) {
                if (!objectsEqual(baseItem[key], compareItem[key])) {
                    highlightedObject[`${key}-is-different`] = baseItem[key];
                } else {
                    highlightedObject[key] = baseItem[key];
                }
            } else {
                // Key exists in Base but not in Compared
                highlightedObject[`${key}-is-different`] = baseItem[key];
            }
        });

        // Add keys that are in Compared but missing in Base
        Object.keys(compareItem).forEach(key => {
            if (!baseItem.hasOwnProperty(key)) {
                highlightedObject[`${key}-is-different`] = compareItem[key];
            }
        });

        return highlightedObject;
    }

    fs.readdir(dirPath, (err, files) => {
        if (err) {
            return console.log('Unable to scan directory: ', err)
        }

        const jsonFiles = files.filter(file => file.endsWith('.json'))

        const groupedFiles = jsonFiles.reduce((acc, file) => {
            const prefix = file.split('_')[0]
            const platform = file.includes('Compare') ? 'Compare' : 'Base'

            if (!acc[prefix]) acc[prefix] = {}
            acc[prefix][platform] = file

            return acc
        }, {})

        const totalPairs = Object.keys(groupedFiles).length;
        let processedPairs = 0;

        Object.keys(groupedFiles).forEach(prefix => {
            const { Compare, Base } = groupedFiles[prefix]

            if (Compare && Base) {
                const CompareData = readJsonFile(Compare)
                const BaseData = readJsonFile(Base)

                const difference = BaseData.map(baseItem => {
                    const matchingcompareItem = CompareData.find(compareItem => objectsEqual(compareItem, baseItem));

                    // If no matching item, return highlighted differences
                    return matchingcompareItem ? null : highlightDifferences(baseItem, CompareData.find(item => item));
                }).filter(diff => diff !== null);

                if (difference.length > 0) {
                    fs.writeFileSync(`./dataComparisonResult/${prefix}.json`, JSON.stringify(difference, null, 2))
                }

                processedPairs++;
                const percentage = ((processedPairs / totalPairs) * 100).toFixed(2); // Calculate percentage
                process.stdout.write(`\rProgress: ${percentage}% (${processedPairs} of ${totalPairs} pairs processed)`); // Print progress on the same line

            } else {
                console.log(`Missing pair for ${prefix}`)
            }
        })
    })
}

async function main() {
    try {

        // Compare
        const tokenCompare = await login(neoCompare)
        await getAllData(neoCompare, tokenCompare)

        // Base
        const tokenBase = await login(neoBase)
        await getAllData(neoBase, tokenBase)

        await comparingData()
    } catch (error) {
        console.error(error.message)
    }
}

main()