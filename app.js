//this is the right one
"use strict";

var util = require('util');
var driverBTHR968 = require('./drivers/BTHR968/driver.js');
var driverTHN132N = require('./drivers/THN132N/driver.js');
var driverPCR800 = require('./drivers/PCR800/driver.js');
var driverUVR128 = require('./drivers/UVR128/driver.js');
var convert = require('./baseConverter.js').jan.ConvertBase;
var initFlag = 1;



// https://www.disk91.com/2013/technology/hardware/oregon-scientific-sensors-with-raspberry-pi/
var dataLayouts = {
    'TH1': {
        len: 7,
        data: {
            temperature: { start: 0, len: 3, div: 10 },
            sign: { start: 3, len: 1 },
            humidity: { start: 4, len: 2 },
            unknown: { start: 6, len: 1 }
        }
    },
    'T1': {
        len: 4,
        data: {
            temperature: { start: 0, len: 3, div: 10 },
            sign: { start: 3, len: 1 }
        }
    },
    'UV1': {
        len: 4,
        data: {
            uvindex: { start: 0, len: 2 },
            unknown: { start: 2, len: 2 }
        }
    },
    'UV2': {
        len: 5,
        data: {
            unknown: { start: 0, len: 3 },
            uvindex: { start: 3, len: 2 }
        }
    },
    'W1': {
        len: 9,
        data: {
            direction: { start: 0, len: 1, enc: 'bin' },
            unknown: { start: 1, len: 2 },
            currentspeed: { start: 3, len: 3, div: 10 },
            averagespeed: { start: 6, len: 3, div: 10 }
        }
    },
    'R1': {
        len: 10,
        data: {
            rainrate: { start: 0, len: 4, div: 100 },  // 0.01 inch/hr
            raintotal: { start: 4, len: 6, div: 1000 } // 0.001 inch
        }
    },
    'R2': {
        len: 8,
        data: {
            rainrate: { start: 0, len: 4, div: 10 },   // 0.1 mm/hr
            raintotal: { start: 4, len: 4, div: 10 }  // 0.1 mm
        }
    },
    'THB': {
        len: 9, // 11 ?
        data: {
            temperature: { start: 0, len: 3, div: 10 },
            sign: { start: 3, len: 1 },
            humidity: { start: 4, len: 2 },
            comfort: {
                start: 6, len: 1, map:
                { 0: 'Normal', 4: 'Comfortable', 8: 'Dry', c: 'Wet' }
            },
            pressure: { start: 7, len: 2, add: 856 }, // mbar
            forecast: {
                start: 9, len: 1, map:
                { 2: 'Cloudy', 3: 'Rainy', 6: 'Partly cloudy', c: 'Sunny' }
            }
        }
    }
}

var knownSensors = {
    '1984': { name: 'WGR800', layout: 'W1' },
    '1994': { name: 'WGR800', layout: 'W1' },
    '1d20': { name: 'THGN123N/THGR122NX', layout: 'TH1' },
    '1a2d': { name: 'THGR228N/THGN132N/THGR918/THGR928/THGRN228/THGN500' },
    'e2cf': { name: 'THGR333/THGN228NX', layout: 'TH1' },   // deze is het // kleine in corona
    '1d30': { name: 'THGN500',layout: 'TH1' }, 
    '1a3d': { name: 'THGR918' },
    '2914': { name: 'PCR800', layout: 'R1' },
    '2a1d': { name: 'RGR918' },
    '2d10': { name: 'RGR968', layout: 'R2' },
    '3a0d': { name: 'STR918/WGR918' },
    '5a5d': { name: 'BTHR918' },
    '5d60': { name: 'BTHR968/BTHR 918N', layout: 'THB' },
    'c844': { name: 'THWR800', layout: 'T1' },
    'd874': { name: 'UVN800', layout: 'UV2' },
    'ec40': { name: 'THN132N/THR238NF', layout: 'T1' },
    'ea4c': { name: 'THWR288A' },
    'ec70': { name: 'UVR128', layout: 'UV1' },  //mijne in corona
    'f824': { name: 'THGN800/THGN801/THGR810', layout: 'TH1' },
    'f8b4': { name: 'THGR810', layout: 'TH1' }
}

/* 
 Orgeon Scientific RF protocol
 Version 2: 
  - Freq. 1024 Hz = 976.5625 us / 2 = 488.28125 us (pulse is 93 us shorter)
  - Coding: 0 = '1001'; 1 = '0110'
  - Preamble:  16 x 1, ie. '0110'
  - Sync: '1010', i.e. '1001', '0110', '1001', '0110'
  - Total sof: 32 + 8 = 40
 Version 3: 
  - Freq. 1024 Hz = 976.5625 us / 2 = 488.28125 us (pulse is 138 us shorter)
  - Coding: 0 = '10'; 1 = '01'
  - Preamble:  24 x 1, ie. '01'
  - Sync: '1010', i.e. '10', '01', '10', '01'
  - Total sof: 24 + 4 = 28
  - Min. len: 4 * (6 + 1 + 4 + 1 + 2 + 1 + x + 2) = (17 + x) * 4 = 68 + x
*/

// Set of all sensors we've found
var Sensors = {};





var self = module.exports = {

    init: function () {

        var setting = {
            useV2: true,
            useV3: true
        };

        // to test availability property of driver
        console.log('app driverBTHR968 connect test  temp = ', driverBTHR968.temp)

        if (initFlag) {
            initFlag = 0;
            var Signal = Homey.wireless('433').Signal;
            
            if (setting.useV2) {
                var signalV2 = new Signal('OregonV2');
                signalV2.register(function (err, success) {
                    if (err != null) console.log('oregonSignal: err', err, 'success', success);
                    else { console.log('signal oregonv2  registered test') }
                });
                //Start receiving
                signalV2.on('payload', function (payload, first) {
                    var rxData = parseRXData(payload, 2); //Convert received array to usable data
                });
            };

            if (setting.useV3) {
                var signalV3 = new Signal('OregonV3');
                signalV3.register(function (err, success) {
                    if (err != null) console.log('oregonSignal: err', err, 'success', success);
                    else { console.log('signal oregonv3  registered') }
                });
                //Start receiving
                signalV3.on('payload', function (payload, first) {
                    var rxData = parseRXData(payload, 3); //Convert received array to usable data
                });
            };
        }
    },

    deleted: function () {
    },
    capabilities: function () {
    }

}



var parseRXData = function (payLoad,version)
//http://stackoverflow.com/questions/3756880/best-way-to-get-two-nibbles-out-of-a-byte-in-javascript

{
    util.log('signal version   ', version);



    var payLoadString = bitArrayToString(payLoad);
    var payLoadArray = bitStringToBitArray(payLoadString);
    var data = payLoadArray


   


  



    var datahex = convert.bin2hex(data);
    console.log('datahex  ', datahex);

      


    
  

    // v2.1 first make bitcount even then extract all uneven bits, they are inverted copy of  message
    if (version == 2) {

        // var data = [];
        // first make data length even
        console.log("arraylength isnoteven   ", !isEven(data.length));
        if (!isEven(data.length)) {
            data.splice(data.lenght - 1, 1);

        };

        util.log('data = array length after making even ', data.length);





        for (var i = data.length - 1; i >= 0; i--) {
            //  util.log('data i ', i);
            if (!isEven(i)) {
                data.splice(i, 1);
            };
        };
        util.log('data = array length after removing uneven bits ', data.length);
        util.log('Version 2 data ');


      













    }  // if v2


    if (version == 3) {
    
        util.log('Version 3 data ');
    }


    // Remove incomplete nibble if present
    var extra = data.length % 4;
    if (extra != 0) {
        util.log('Removing incomplete nibble from message');
        data.splice(data.length - extra, extra);
        util.log('data = array length ', data.length);
    }


    // Flip the nibbles and make a string from the array
    var datastring = '';
    for (var i = 0; i < data.length; i += 4) {
        datastring += (data.slice(i, i + 4)).reverse().join('');
    }

    // for testing
    decodeNibbles(datastring);


    // to check nan from result  in decodedata
    if (version == 2) {
        var baroNibble1 = datastring.slice(64, 68);
        var baroNibble2 = datastring.slice(68, 72);
        var baroNibble3 = datastring.slice(72, 76);



        //convert.bin2hex(baroNibble3) = always 0xC
        var baroHex = convert.bin2hex(baroNibble2) + convert.bin2hex(baroNibble1);  // 27-08 changed 3and 1 
        util.log('barohex  ', baroHex);
        var baroDec = convert.hex2dec(baroHex);
        util.log('baroDex  ', baroDec);
        var barometerdec = parseInt(baroDec) + 856;


        util.log('barometer JIIIIIIIIIIIIIIIIl  ', barometerdec);

    };
















    // Decode the data part
    var result = decodeData(datastring);
    util.log('                                                     jilles result not atring     ', util.inspect(result, false, null));
    if (typeof result != 'string') {
        // Now we have all elements for the unique device ID
        // Note: from user perspective it is nicer not to include the
        //       rollingCode, as this changes when replacing batteries.
        var uniqueId = result.id + ':' + result.channel + ':' + result.rolling;

        if (Sensors[uniqueId] == null) {
            Sensors[uniqueId] = {};
            util.log('Found a new sensor. Total found is now', (Object.keys(Sensors).length));
        }
        // TODO: update only if needed and send an event
        // TODO: add comfort and forecast as custom capability
        var newdata = false;
        for (var r in result) {
            if (result[r] != Sensors[uniqueId][r]) {
                newdata = true;
            }
        }
        util.log('Sensor value has changed:', newdata);

        // Add additional data
        result.lastupdate = new Date();
        result.count = (Sensors[uniqueId].count || 0) + 1;
        result.newdata = newdata;
        // Update the sensor log
        Sensors[uniqueId] = result;
        util.log(Sensors);

        // jilles goto makeHomeyDriverCompatibleAandPasstoDriver(result)
        makeHomeyDriverCompatibleAandPasstoDriver(result)
    }  // decodedatapart
        
		/*
		   Start Jilles code
		*/

     //first 4 nibbles are address
    var deviceaddressstring = datastring.slice(0, 16);
    util.log('deviceaddressstring  length ', deviceaddressstring.length);
    util.log('deviceaddressstring  before nibble lsfb ', deviceaddressstring);
    var hexaddress = convert.bin2hex(deviceaddressstring);
    util.log('device address hex ', hexaddress);

    var SensorID = hexaddress;


      

        // if data is readable and known sensor
    //if (hexaddress == '5d60' || hexaddress == "1d20" || hexaddress == "1a2d" || hexaddress == "e2cf" || hexaddress == "2914") {


    //    //5th nibbel channel
    //    var channelnibble = datastring.slice(16, 20);
    //    util.log('channel lsfb nibble ', channelnibble);
    //    var channel = channelnibble.slice(4, 4);

    //    //nibble 6,7 rollingcode
    //    var rollingCodenibble1 = datastring.slice(20, 24);
    //    var rollingCodenibble2 = datastring.slice(24, 28);
    //    // mark the inversion of nibbles in and outside
    //    var rollingCode = convert.bin2hex(rollingCodenibble2 + rollingCodenibble1);
    //    util.log('rolling code ', rollingCode);

    //    // 8th nibble is battery
    //    // bit 0x4 is = battery low = 0100
    //    var batterynibble = datastring.slice(28, 32);
    //    util.log('batterynibble ', batterynibble);
    //    var batteryFlagBit = batterynibble.slice(1, 2);
    //    util.log('batteryFlagBit ', batteryFlagBit);
    //    var battery;
    //    var batteryforhomey;
    //   
    //    if (batteryFlagBit == '1') {
    //        battery = 'empty';
    //        batteryforhomey = 10;
    //        util.log('battery  ', battery);
    //    }
    //    else if (batteryFlagBit == '0') {
    //        battery = 'OK';
    //        batteryforhomey = 90;
    //        util.log('battery  ', battery);
    //    };


    //        // nibbles 8 to 11
    //        //  mark the inversion of nibbles in and outside

    //        var temperatureNibble1 = datastring.slice(32, 36);
    //        var temperatureNibble2 = datastring.slice(36, 40);
    //        var temperatureNibble3 = datastring.slice(40, 44);
    //        var temperatureNibble4 = datastring.slice(44, 48);

    //        var temperatureHex = convert.bin2hex(temperatureNibble4 + temperatureNibble3 + temperatureNibble2 + temperatureNibble1);

    //        util.log('temperaturehex  ', temperatureHex);

    //        var temperature = convert.bin2hex(temperatureNibble3) + convert.bin2hex(temperatureNibble2) + '.' + convert.bin2hex(temperatureNibble1)

    //        util.log(' negative temparaturesignhex  ', convert.bin2hex(temperatureNibble4));

    //        if (!(convert.bin2hex(temperatureNibble4) == 0))
    //        { temperature = '-' + temperature; }

    //        util.log('temperaturehex  ', temperature);



    //        //nibbles 13,12 humidity in percent

    //        var humidityNibble1 = datastring.slice(48, 52);
    //        var humidityNibble2 = datastring.slice(52, 56);

    //        var humidityhex = convert.bin2hex(humidityNibble2) + convert.bin2hex(humidityNibble1);
    //        var humidity = humidityhex; // means bcd hex numbers are digital numbers
    //        util.log('humidityhex  ', humidityhex + '  %');

    //       // util.log('result humidity qualification ', result.data.comfort);

    //        // nibbles 14,15 unknown


    //        var nibble14 = datastring.slice(56, 60);
    //        var nibble15 = datastring.slice(60, 64);

    //        var u14to15hex = convert.bin2hex(nibble15) + convert.bin2hex(nibble14);
    //        util.log('unknownhex  ', u14to15hex);
    //        util.log('unknowndec  ', convert.hex2dec(u14to15hex));


    //        //nibbles 18..16  barometer
    //        //http://www.cs.stir.ac.uk/~kjt/software/comms/wmr928.html



    //        //  add direct info to right driver
    //        if (hexaddress == '5d60')

    //        {
    //            temphydrobaro(datastring);
    //            var baroNibble1 = datastring.slice(64, 68);
    //            var baroNibble2 = datastring.slice(68, 72);
    //            var baroNibble3 = datastring.slice(72, 76);



    //            //convert.bin2hex(baroNibble3) = always 0xC
    //            var baroHex = convert.bin2hex(baroNibble1) + convert.bin2hex(baroNibble2);
    //            util.log('barohex  ', baroHex);
    //            var baroDec = convert.hex2dec(baroHex);
    //            util.log('baroDex  ', baroDec);
    //            var barometerdec = parseInt(baroDec) + 856;


    //            util.log('barometer  ', barometerdec);

    //            var pressure = barometerdec;

    //            var forecasthex = convert.bin2hex(baroNibble3);
    //            var forecast;
    //            //Forecast:  2 = Cloudy, 3 = Rainy, 6 = Cloudy with Sun, C = Sunny
    //            switch (forecasthex) {
    //                case "C":
    //                    forecast = "Sunny";
    //                    break;
    //                case "6":
    //                    forecast = "Cloudy with Sun";
    //                    break;
    //                case "3":
    //                    forecast = "Rainy";
    //                    break;
    //                case "2":
    //                    forecast = "Cloudy";
    //                    break;
    //            }



    //            util.log('forecast ? ', forecast);



    //            //nibbles 20..19  checksum ?

    //            var nibble19 = datastring.slice(80, 84);
    //            util.log('nibble19  ', nibble19);
    //            var nibble20 = datastring.slice(84, 88);
    //            util.log('nibble20  ', nibble20);
    //            var chksm19to20hex = convert.bin2hex(nibble19) + convert.bin2hex(nibble20);
    //            util.log('chksm19to20hex  ', chksm19to20hex);
    //            util.log('chksm19to20dec  ', convert.hex2dec(chksm19to20hex));




    //            //  3 bytes to go 














    //            oregonBTHR968Device =
    //                {
    //                    id: SensorID + rollingCode,
    //                    SensorID: SensorID,
    //                    channel: channel,
    //                    rollingCode: rollingCode,
    //                    battery: batteryforhomey,
    //                    temperature: parseFloat(parseFloat(temperature).toFixed(2)),
    //                    humidity: parseInt(humidity),
    //                    pressure: parseInt((Number(pressure)).toFixed(2)),
    //                    forecast: forecast
    //                };


    //            var homeyDevice =
    //                {
    //                    data: { id: oregonBTHR968Device.id },
    //                    name: oregonBTHR968Device.id,
    //                    capabilities: ["measure_humidity", "measure_pressure", "measure_temperature", "measure_battery"],
    //                    measure_temperature: oregonBTHR968Device.temperature,
    //                    measure_humidity: oregonBTHR968Device.humidity,
    //                    measure_pressure: oregonBTHR968Device.pressure,
    //                    measure_battery: oregonBTHR968Device.battery,
    //                };

    //            function checkIfDeviceIsInHod(deviceIn) {
    //                var matches = driverBTHR968.homeyDevices.filter(function (d) {
    //                    return d.address == deviceIn.address;
    //                });
    //                return matches ? matches : null;
    //            }

    //            // a = array obj = element
    //            function contains(a, obj) {
    //                for (var i = 0; i < a.length; i++) {
    //                    if (a[i].data.id == obj.data.id) {
    //                        return true;
    //                    }
    //                }
    //                return false;
    //            }

    //            // console.log('567 parserxdata homeyDevices', util.inspect(homeyDevices, false, null))

    //            if (!contains(driverBTHR968.homeyDevices, homeyDevice)) {
    //                driverBTHR968.homeyDevices.push(homeyDevice);
    //            } else {

    //                driverBTHR968.updateCapabilitiesHomeyDevice(homeyDevice);
    //            }
    //            // return homeyDevices;
    //        }; // if 5d60

    //        // THGR122NX
    //        if (hexaddress == '1d20' || hexaddress == "1a2d" || hexaddress == "e2cf") {

    //            oregonTHGR122NXDevice =
    //                {
    //                    id: SensorID + rollingCode,
    //                    SensorID: SensorID,
    //                    channel: channel,
    //                    rollingCode: rollingCode,
    //                    battery: batteryforhomey,
    //                    temperature: parseFloat(parseFloat(temperature).toFixed(2)),
    //                    humidity: parseInt(humidity),
    //                    pressure: parseInt((Number(pressure)).toFixed(2)),
    //                    forecast: forecast
    //                };


    //            var homeyDevice =
    //                {
    //                    data: { id: oregonTHGR122NXDevice.id },
    //                    name: oregonTHGR122NXDevice.id,
    //                    capabilities: ["measure_temperature", "measure_humidity", "measure_battery"],
    //                    measure_temperature: oregonTHGR122NXDevice.temperature,
    //                    measure_humidity: oregonTHGR122NXDevice.humidity,
    //                    measure_battery: oregonTHGR122NXDevice.battery,
    //                };

          











    //            function checkIfDeviceIsInHod(deviceIn) {
    //                var matches = driverTHGR122NX.homeyDevices.filter(function (d) {
    //                    return d.address == deviceIn.address;
    //                });
    //                return matches ? matches : null;
    //            }

    //            // a = array obj = element
    //            function contains(a, obj) {
    //                for (var i = 0; i < a.length; i++) {
    //                    if (a[i].data.id == obj.data.id) {
    //                        return true;
    //                    }
    //                }
    //                return false;
    //            }

    //            // console.log('567 parserxdata homeyDevices', util.inspect(homeyDevices, false, null))

    //            if (!contains(driverTHGR122NX.homeyDevices, homeyDevice)) {
    //                driverTHGR122NX.homeyDevices.push(homeyDevice);
    //            } else {

    //                driverTHGR122NX.updateCapabilitiesHomeyDevice(homeyDevice);
    //            }










    //        };  // if 1d20












    //    }; //if correct device
   



    
 



}; //parserxdata

var temphydrobaro = function(datastring) {


};


var numberToBitArray = function (number, bit_count) {
    var result = [];
    for (var i = 0; i < bit_count; i++)
        result[i] = (number >> i) & 1;
    return result;
};

var bitArrayToNumber = function (bits) {
    return parseInt(bits.join(""), 2);
};

var bitStringToBitArray = function (str) {
    var result = [];
    for (var i = 0; i < str.length; i++)
        result.push(str.charAt(i) == '1' ? 1 : 0);
    return result;
};

var bitArrayToString = function (bits) {
    return bits.join("");
};





function lsbfNibble(nib) {
    //  util.log('nibble as par for f   ', nib);

    var lsfbnib = ""
    lsfbnib = nib.slice(3);
    // util.log('nibble0  ', lsfbnib);
    lsfbnib += nib.slice(2, 3);
    //  util.log('nibble1  ', lsfbnib);
    lsfbnib += nib.slice(1, 2);
    //  util.log('nibble2  ', lsfbnib);
    lsfbnib += nib.slice(0, 1);
    //  util.log('nibble3  ', lsfbnib);

    return lsfbnib;
};

// create global unique identifier
function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + + s4() + s4() +
        s4() + s4() + s4() + s4();
}

function isEven(n) {
    return n % 2 == 0;
}


function calcChecksum(data, end) {
    var slice = data.slice(end + 4, end + 8) + data.slice(end, end + 4);
    util.log(slice);
    var check = Number(convert.bin2dec(slice));
    util.log('Read checksum: ' + check);
    var checksum = 0;
    for (var i = 0; i < end / 4; i++) {
        var nibble = data.slice(i * 4, i * 4 + 4);
        checksum += Number(convert.bin2dec(nibble));
    }
    util.log('Calculated checksum: ' + checksum);
    return (checksum == check);
}

function decodeData(data) {
    var id = ('0000' + convert.bin2hex(data.slice(0, 16))).slice(-4);
    util.log('Device id hex', id);
    var values = id;

   // util.log('sensor id layout ', util.inspect(knownSensors[id].layout, false, null));

    var layout = (knownSensors[id] != null ? knownSensors[id].layout : null);
    if (dataLayouts[layout] != null) {
        // Check the checksum before we start decoding
        var pos = 32 + 4 * dataLayouts[layout].len;
        var valid = calcChecksum(data, pos);

        // Decode the values if the payload is valid
        // TODO valid is checked out
        if (valid || !valid) {                                           //first check if valid data
            util.log('Sensor type:', knownSensors[id].name);

            // Nibble 5 is the channel
            var channel = convert.bin2dec(data.slice(16, 20));
            util.log('Channel number:', channel);

            // Nibble 6 & 7 contain the rolling code
            var rollingCode = convert.bin2hex(data.slice(20, 28));
            util.log('Rolling code:', rollingCode);

            // Nibble 8 contains the flags
            // bit 2 (0x4) is the low battery indicator
            var flagnibble = data.slice(28, 32);
            util.log('Flag nibble:', flagnibble);

            var lowbattery = flagnibble[1] == '1';
            util.log('Low battery:', lowbattery);

            // Store the results so far
            values = {
                name: knownSensors[id].name,
                layout: knownSensors[id].layout,
                id: id,
                channel: channel,
                rolling: rollingCode,
                lowbattery: lowbattery,
                data: {}
            };

            // Decode data part of the message
            data = data.slice(32);
            for (var p in dataLayouts[layout].data) {
                var value = 0;
                var elem = dataLayouts[layout].data[p];
                for (var i = elem.len - 1; i >= 0; i--) {
                    var nibble = data.slice(4 * (elem.start + i), 4 * (elem.start + 1 + i));
                    //util.log(nibble);
                    if (elem.enc == null) {
                        value += convert.bin2hex(nibble);
                    } else if (elem.enc == 'bin') {
                        value = convert.bin2dec(nibble);
                    }
                }
                if (p == 'direction') {
                    value *= 22.5;
                } else if (elem.map != null) {
                    value = elem.map[value] || 'Unknown';
                } else if (p != 'unknown') {
                    value = Number(value);
                    if (elem.div != null) {
                        value /= elem.div;
                    }
                    if (elem.add != null) {
                        value += elem.add;
                    }
                }
                values.data[p] = value;
                util.log('Data > ' + p + ':', value);
            }
            if (values.data.sign != null) {
                if (Number(values.data.sign) > 0) {
                    values.data.temperature *= -1;
                }
                delete (values.data.sign);
            }
        } else {
            util.log('Checksum mismatch - ignoring message');
        }
    }  // datalayou = !null

    else {
        util.log('Unknown sensor ID ' + id + '; ignoring...');
    }

    util.log('values ', util.inspect(values, false, null));
    return values;

}


function decodeNibbles(data) {
    util.log('data = array length start decodeNibble ', data.length);



    var mod = data.length % 4;
    var leng = data.length;
    util.log(' data length before mod  ', leng);
    util.log('  mod nibble    ', mod);
    util.log('  !(mod == 0)  ', !(mod == 0)  );

    if (!(mod == 0)) {
        data = data.slice(0, (data.length - mod));
    }

    leng = data.length;

    util.log(' data length after mod substraction ', leng);


    var nibblecount = data.length / 4;

    util.log('   data nibbles length   ', nibblecount);
    util.log('   data bytes length  ', data.length / 8);

    var nibbleArray = [];
    var hexstring = '';

    for (var i = 0, j = 0; i < data.length; i += 4, j += 1) {
        nibbleArray[j] = (data.slice(i, i + 4));

     //   util.log(' i   ', i, '  j  ', j);
    //    util.log('  nibbleArray[j]  ', nibbleArray[j]);

        hexstring = hexstring + convert.bin2hex(nibbleArray[j])

      //  util.log('  nibbleArray[j] to hex  ', convert.bin2hex(nibbleArray[j]));
      //  util.log('  nibbleArray[j] to dec  ', convert.bin2dec(nibbleArray[j]));
    }

    util.log('   hexstring  ', util.inspect(hexstring      , false, null));
  //  util.log(' nibbleArray   ', util.inspect(nibbleArray     , false, null));
   
} // end decode nibbles


  // a = array obj = element
function contains(a, obj) {
    for (var i = 0; i < a.length; i++) {
        if (a[i].data.id == obj.data.id) {
            return true;
        }
    }
    return false;
}

function checkIfDeviceIsInHod(deviceIn) {
    var matches = driverBTHR968.homeyDevices.filter(function (d) {
        return d.address == deviceIn.address;
    });
    return matches ? matches : null;
}

//#region choosedevice
function makeHomeyDriverCompatibleAandPasstoDriver(result) {


    switch (result.id) {

        case "5d60":
            processBTHR968(result);
            break;
        case "1d20":
            processTHGR122NX(result);
            break
        case "1d30":    // kleine corona THGN228NX
            processTHGR122NX(result);
            break;
        case "e2cf":    // kleine corona THGN228NX
            processTHGR122NX(result);
            break;
        case "2914":  // regenmeter
            processPCR800(result);
            break;
        case "ec70":  // UVR128 uv meter corona
            processUVR128(result);
            break;
        case "ec40":  // THN132n only temp 
            processTHN132N(result);
            break;

        }

}
//#endregion




function processBTHR968(result)
{
    util.log('  processBTHR968(result) enterd  ');

   var oregonBTHR968Device =
        {
            id: result.id +result.rolling,
            SensorID: result.id,
            channel: result.channel,
            rollingCode: result.rolling,
            battery: result.lowbattery,
            temperature: parseFloat(parseFloat(result.data.temperature).toFixed(2)),
            humidity: parseInt(result.data.humidity),
            pressure: parseInt((Number(result.data.pressure)).toFixed(2)),
            forecast: result.data.forecast
        };


    var homeyDevice =
        {
            data: { id: oregonBTHR968Device.id },
            name: oregonBTHR968Device.id,
            capabilities: ["measure_humidity", "measure_pressure", "measure_temperature", "alarm_battery"],
            measure_temperature: oregonBTHR968Device.temperature,
            measure_humidity: oregonBTHR968Device.humidity,
            measure_pressure: oregonBTHR968Device.pressure,
            alarm_battery: oregonBTHR968Device.battery,
        };

   
  

    // console.log('567 parserxdata homeyDevices', util.inspect(homeyDevices, false, null))

    if (!contains(driverBTHR968.homeyDevices, homeyDevice)) {
        driverBTHR968.homeyDevices.push(homeyDevice);
    } else {

        driverBTHR968.updateCapabilitiesHomeyDevice(homeyDevice);
    }
            // return homeyDevices;

} // end device

function processTHGR122NX(result)
{
   var  oregonTHGR122NXDevice =
        {
        id: result.id + result.rolling,
        SensorID: result.id,
        channel: result.channel,
        rollingCode: result.rolling,
        battery: result.lowbattery,
        temperature: parseFloat(parseFloat(result.data.temperature).toFixed(2)),
        humidity: parseInt(result.data.humidity),
        };


    var homeyDevice =
        {
            data: { id: oregonTHGR122NXDevice.id },
            name: oregonTHGR122NXDevice.id,
            capabilities: ["measure_temperature", "measure_humidity", "alarm_battery"],
            measure_temperature: oregonTHGR122NXDevice.temperature,
            measure_humidity: oregonTHGR122NXDevice.humidity,
            alarm_battery: oregonTHGR122NXDevice.battery,
        };


   

    if (!contains(driverTHGR122NX.homeyDevices, homeyDevice)) {
        driverTHGR122NX.homeyDevices.push(homeyDevice);
    } else {

        driverTHGR122NX.updateCapabilitiesHomeyDevice(homeyDevice);
    }
    
};  // end device

function processTHN132N(result) {
    var oregonTHN132NDevice =
        {
            id: result.id + result.rolling,
            SensorID: result.id,
            channel: result.channel,
            rollingCode: result.rolling,
            battery: result.lowbattery,
            temperature: parseFloat(parseFloat(result.data.temperature).toFixed(2)),
           };


    var homeyDevice =
        {
            data: { id: oregonTHN132NDevice.id },
            name: oregonTHN132NDevice.id,
            capabilities: ["measure_temperature", "measure_humidity", "alarm_battery"],
            measure_temperature: oregonTHN132NDevice.temperature,
            measure_humidity: oregonTHN132NDevice.humidity,
            alarm_battery: oregonTHN132NDevice.battery,
        };


    if (!contains(driverTHN132N.homeyDevices, homeyDevice)) {
        driverTHN132N.homeyDevices.push(homeyDevice);
    } else {

        driverTHN132N.updateCapabilitiesHomeyDevice(homeyDevice);
    }

};  // end device



function processPCR800(result) {

    var oregonPCR800Device =
        {
            id: result.id + result.rolling,
            SensorID: result.id,
            channel: result.channel,
            rollingCode: result.rolling,
            battery: result.lowbattery,
            rain: result.data.rainrate,
            raintotal: result.data.raintotal
        };


    var homeyDevice =
        {
            data: { id: oregonPCR800Device.id },
            name: oregonPCR800Device.id,
            capabilities: ["measure_rain"],// ["measure_rain","measure_raintotal"],
            measure_rain: oregonPCR800Device.rain,
            alarm_battery: oregonPCR800Device.battery,
        };




    if (!contains(driverPCR800.homeyDevices, homeyDevice)) {
        driverPCR800.homeyDevices.push(homeyDevice);
    } else {

        driverPCR800.updateCapabilitiesHomeyDevice(homeyDevice);
    }

};  // end device


function processUVR128(result) {

    var oregonUVR128Device =
        {
            id: result.id + result.rolling,
            SensorID: result.id,
            channel: result.channel,
            rollingCode: result.rolling,
            battery: result.lowbattery,
            uvindex: result.data.uvindex,
          
        };


    var homeyDevice =
        {
            data: { id: oregonUVR128Device.id },
            name: oregonUVR128Device.id,
            capabilities: ["measure_ultraviolet"],// ["measure_rain"],
            measure_ultraviolet: oregonUVR128Device.uvindex,
            alarm_battery: oregonUVR128Device.battery,
        };




    if (!contains(driverUVR128.homeyDevices, homeyDevice)) {
        driverUVR128.homeyDevices.push(homeyDevice);
    } else {

        driverUVR128.updateCapabilitiesHomeyDevice(homeyDevice);
    }

};  // end device













//TODO: nothing
//TODO remove not valid and checksum check






   ////old original decodepart

    ////first 4 nibbles are address
    //var deviceaddressstring = datastring.slice(0, 16);
    //util.log('deviceaddressstring  length ', deviceaddressstring.length);

    ////   util.log('deviceaddressstring  before nibble lsfb ', deviceaddressstring);

    //var nibble1 = deviceaddressstring.slice(0, 4);
    //var nibble2 = deviceaddressstring.slice(4, 8);
    //var nibble3 = deviceaddressstring.slice(8, 12);
    //var nibble4 = deviceaddressstring.slice(12, 16);

    //var nibble1 = lsbfNibble(nibble1);
    //var nibble2 = lsbfNibble(nibble2);
    //var nibble3 = lsbfNibble(nibble3);
    //var nibble4 = lsbfNibble(nibble4);

    //deviceaddressstring = nibble1 + nibble2 + nibble3 + nibble4;

    //util.log('deviceaddressstring  after nibble lsfb ', deviceaddressstring);



    //var hexaddress = convert.bin2hex(deviceaddressstring);
    //util.log('device address hex ', hexaddress);

    //var SensorID = hexaddress;

    //if (hexaddress == '2914')
    //{ util.log('RAIN !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!', hexaddress) };


    //// if data are readable and konwn sensor
    //if (hexaddress == '5d60' || hexaddress == "1d20" || hexaddress == "1a2d") {

    //    //5th nibbel channel
    //    var channelnibble = datastring.slice(16, 20);

    //    channelnibble = lsbfNibble(channelnibble);
    //    util.log('channel lsfb nibble ', channelnibble);

    //    var channel = channelnibble.slice(4, 4);

    //    //nibble 6,7 rollingcode
    //    var rollingCodenibble1 = lsbfNibble(datastring.slice(20, 24));
    //    var rollingCodenibble2 = lsbfNibble(datastring.slice(24, 28));

    //    // mark the inversion of nibbles in and outside
    //    var rollingCode = convert.bin2hex(rollingCodenibble2 + rollingCodenibble1);
    //    util.log('rolling code ', rollingCode);

    //    // 8th nibble is battery
    //    // bit 0x4 is = battery low = 0100
    //    var batterynibble = lsbfNibble(datastring.slice(28, 32));
    //    util.log('batterynibble ', batterynibble);

    //    //var batterynibblehex = convert.bin2hex(batterynibble);
    //    //util.log('batterynibblehex  ', batterynibblehex);

    //    var batteryFlagBit = batterynibble.slice(1, 2);

    //    util.log('batteryFlagBit ', batteryFlagBit);
    //    var battery;
    //    var batteryforhomey;

    //    if (batteryFlagBit == '1') {
    //        battery = 'empty';
    //        batteryforhomey = 10;
    //        util.log('battery  ', battery);
    //    }
    //    else if (batteryFlagBit == '0') {
    //        battery = 'OK';
    //        batteryforhomey = 90;
    //        util.log('battery  ', battery);
    //    };


    //    // nibbles 8 to 11
    //    //  mark the inversion of nibbles in and outside

    //    var temperatureNibble1 = lsbfNibble(datastring.slice(32, 36));
    //    var temperatureNibble2 = lsbfNibble(datastring.slice(36, 40));
    //    var temperatureNibble3 = lsbfNibble(datastring.slice(40, 44));
    //    var temperatureNibble4 = lsbfNibble(datastring.slice(44, 48));

    //    var temperatureHex = convert.bin2hex(temperatureNibble4 + temperatureNibble3 + temperatureNibble2 + temperatureNibble1);

    //    util.log('temperaturehex  ', temperatureHex);

    //    var temperature = convert.bin2hex(temperatureNibble3) + convert.bin2hex(temperatureNibble2) + '.' + convert.bin2hex(temperatureNibble1)

    //    util.log(' negative temparaturesignhex  ', convert.bin2hex(temperatureNibble4));

    //    if (!(convert.bin2hex(temperatureNibble4) == 0))
    //    { temperature = '-' + temperature; }

    //    util.log('temperaturehex  ', temperature);



    //    //nibbles 13,12 humidity in percent

    //    var humidityNibble1 = lsbfNibble(datastring.slice(48, 52));
    //    var humidityNibble2 = lsbfNibble(datastring.slice(52, 56));

    //    var humidityhex = convert.bin2hex(humidityNibble2) + convert.bin2hex(humidityNibble1);
    //    var humidity = humidityhex; // means bcd hex numbers are digital numbers
    //    util.log('humidityhex  ', humidityhex + '  %');

    //    // nibbles 14,15 unknown


    //    var nibble14 = lsbfNibble(datastring.slice(56, 60));
    //    var nibble15 = lsbfNibble(datastring.slice(60, 64));

    //    var u14to15hex = convert.bin2hex(nibble15) + convert.bin2hex(nibble14);
    //    util.log('unknownhex  ', u14to15hex);
    //    util.log('unknowndec  ', convert.hex2dec(u14to15hex));


    //    //nibbles 18..16  barometer
    //    //http://www.cs.stir.ac.uk/~kjt/software/comms/wmr928.html



    //    //  add direct info to right driver
    //    if (hexaddress == '5d60') {
    //        var baroNibble1 = lsbfNibble(datastring.slice(64, 68));
    //        var baroNibble2 = lsbfNibble(datastring.slice(68, 72));
    //        var baroNibble3 = lsbfNibble(datastring.slice(72, 76));



    //        //convert.bin2hex(baroNibble3) = always 0xC
    //        var baroHex = convert.bin2hex(baroNibble1) + convert.bin2hex(baroNibble2);
    //        util.log('barohex  ', baroHex);
    //        var baroDec = convert.hex2dec(baroHex);
    //        util.log('baroDex  ', baroDec);
    //        var barometerdec = parseInt(baroDec) + 856;


    //        util.log('barometer  ', barometerdec);

    //        var pressure = barometerdec;

    //        var forecasthex = convert.bin2hex(baroNibble3);
    //        var forecast;
    //        //Forecast:  2 = Cloudy, 3 = Rainy, 6 = Cloudy with Sun, C = Sunny
    //        switch (forecasthex) {
    //            case "C":
    //                forecast = "Sunny";
    //                break;
    //            case "6":
    //                forecast = "Cloudy with Sun";
    //                break;
    //            case "3":
    //                forecast = "Rainy";
    //                break;
    //            case "2":
    //                forecast = "Cloudy";
    //                break;
    //        }



    //        util.log('forecast ? ', forecast);



    //        //nibbles 20..19  checksum ?

    //        var nibble19 = lsbfNibble(datastring.slice(80, 84));
    //        util.log('nibble19  ', nibble19);
    //        var nibble20 = lsbfNibble(datastring.slice(84, 88));
    //        util.log('nibble20  ', nibble20);
    //        var chksm19to20hex = convert.bin2hex(nibble19) + convert.bin2hex(nibble20);
    //        util.log('chksm19to20hex  ', chksm19to20hex);
    //        util.log('chksm19to20dec  ', convert.hex2dec(chksm19to20hex));




    //        //  3 bytes to go 














    //    oregonBTHR968Device =
    //        {
    //            id: SensorID + rollingCode,
    //            SensorID: SensorID,
    //            channel: channel,
    //            rollingCode: rollingCode,
    //            battery: batteryforhomey,
    //            temperature: parseFloat(parseFloat(temperature).toFixed(2)),
    //            humidity: parseInt(humidity),
    //            pressure: parseInt((Number(pressure)).toFixed(2)),
    //            forecast: forecast
    //        };


    //    var homeyDevice =
    //        {
    //            data: { id: oregonBTHR968Device.id },
    //            name: oregonBTHR968Device.id,
    //            capabilities: ["measure_humidity", "measure_pressure", "measure_temperature", "alarm_battery"],
    //            measure_temperature: oregonBTHR968Device.temperature,
    //            measure_humidity: oregonBTHR968Device.humidity,
    //            measure_pressure: oregonBTHR968Device.pressure,
    //            measure_battery: oregonBTHR968Device.battery,
    //        };

    //    function checkIfDeviceIsInHod(deviceIn) {
    //        var matches = driverBTHR968.homeyDevices.filter(function (d) {
    //            return d.address == deviceIn.address;
    //        });
    //        return matches ? matches : null;
    //    }

    //    // a = array obj = element
    //    function contains(a, obj) {
    //        for (var i = 0; i < a.length; i++) {
    //            if (a[i].data.id == obj.data.id) {
    //                return true;
    //            }
    //        }
    //        return false;
    //    }

    //   // console.log('567 parserxdata homeyDevices', util.inspect(homeyDevices, false, null))

    //    if (!contains(driverBTHR968.homeyDevices, homeyDevice)) {
    //        driverBTHR968.homeyDevices.push(homeyDevice);
    //    } else {

    //        driverBTHR968.updateCapabilitiesHomeyDevice(homeyDevice);
    //    }
    //    // return homeyDevices;
    //    }; // if 5d60

    //   // THGR122NX
    //    if (hexaddress == '1d20' || hexaddress == "1a2d") {

    //        if (hexaddress == "1a2d")
    //        { console.log('1a2d found  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!?????????????') };

    //        oregonTHGR122NXDevice =
    //            {
    //                id: SensorID + rollingCode,
    //                SensorID: SensorID,
    //                channel: channel,
    //                rollingCode: rollingCode,
    //                battery: batteryforhomey,
    //                temperature: parseFloat(parseFloat(temperature).toFixed(2)),
    //                humidity: parseInt(humidity),
    //                pressure: parseInt((Number(pressure)).toFixed(2)),
    //                forecast: forecast
    //            };


    //        var homeyDevice =
    //            {
    //                data: { id: oregonTHGR122NXDevice.id },
    //                name: oregonTHGR122NXDevice.id,
    //                capabilities: ["measure_temperature","measure_humidity" , "measure_battery"],
    //                measure_temperature: oregonTHGR122NXDevice.temperature,
    //                measure_humidity: oregonTHGR122NXDevice.humidity,
    //                measure_battery: oregonTHGR122NXDevice.battery,
    //            };

    //        function checkIfDeviceIsInHod(deviceIn) {
    //            var matches = driverTHGR122NX.homeyDevices.filter(function (d) {
    //                return d.address == deviceIn.address;
    //            });
    //            return matches ? matches : null;
    //        }

    //        // a = array obj = element
    //        function contains(a, obj) {
    //            for (var i = 0; i < a.length; i++) {
    //                if (a[i].data.id == obj.data.id) {
    //                    return true;
    //                }
    //            }
    //            return false;
    //        }

    //        // console.log('567 parserxdata homeyDevices', util.inspect(homeyDevices, false, null))

    //        if (!contains(driverTHGR122NX.homeyDevices, homeyDevice)) {
    //            driverTHGR122NX.homeyDevices.push(homeyDevice);
    //        } else {

    //            driverTHGR122NX.updateCapabilitiesHomeyDevice(homeyDevice);
    //        }










    //    };












    //}; //if correct device