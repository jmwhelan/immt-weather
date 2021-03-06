const Nightmare = require('nightmare')
const cheerio = require('cheerio');
const Prowl = require('node-prowl');
const fs = require('fs');
const request = require('request');
const path = require('path');
const _ = require("lodash");

const nightmare = Nightmare({
    show: false
});

const url = 'https://www.mont-tremblant.ca/en/training-mont-tremblant';
let config = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'config.json')));

let prowlKey = config.prowlKey;
let openWeatherMapKey = config.openWeatherMapKey;
let city = config.city;
let units = config.units;
const prowl = new Prowl(prowlKey);

const getWaterTemp = async () => {
    let getWaterTempData = html => {
        const $ = cheerio.load(html);
        let temperature = $('a.temperature > div.sideText > div.info').text().split('C');
        temperature[0] = temperature[0] + "C";
        return temperature;
    }   

    const result = await nightmare
        .goto(url)
        .wait('body')
        .evaluate(() => document.querySelector('body').innerHTML)
        .end()
        .then(response => {
            waterTemp = getWaterTempData(response)[0];
            return waterTemp;
        }).catch(err => {
            console.log(err);
        });

    return result;
}

let sendNotification = (temp, weather) => {
    let message = `Water: ${temp.replace(" ", "")}, Forecast: ${weather}`;
    console.log(message);
    prowl.push(message, '2020 IMMT 140.6', {
        priority: 2,
        url: url
    }, function (err, remaining) {
        if (err) throw err;
    });
}

function getWeather() {
    return new Promise(function (resolve, reject) {
        let currentDate = new Date();        
        let immtDate = new Date('08/18/2019');        

        let dayCount = Math.ceil(Math.abs(immtDate.getTime() - currentDate.getTime()) / (1000 * 3600 * 24)) + 2;

        let getWeatherData = jsonString => {
            let json = JSON.parse(jsonString);

            let dayWeather = _.find(json.list, function (o) {
                let d = new Date(0);
                d.setUTCSeconds(o.dt);
                return (d.getDate() == immtDate.getDate() && d.getMonth() == immtDate.getMonth());
            });

            let weatherString = `L: ${Math.trunc(dayWeather.temp.morn)}°C, H: ${Math.trunc(dayWeather.temp.max)}°C, E: ${Math.trunc(dayWeather.temp.eve)}°C, ${dayWeather.weather[0].description}, Wind: ${Math.round(dayWeather.speed * 3.6)}kph`;
            return weatherString;
        }

        let url = `http://api.openweathermap.org/data/2.5/forecast/daily?q=${city}&appid=${openWeatherMapKey}&cnt=${dayCount}&units=${units}`;

        request(url, function (err, response, body) {
            if (err) {
                reject(e);
            } else {
                resolve(getWeatherData(body));
            }
        });
    });
}

Promise.all([getWaterTemp(), getWeather()]).then(function (values) {
    sendNotification(values[0], values[1]);
});