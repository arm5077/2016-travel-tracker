var express = require("express");
var app = express();
var moment = require('moment');
var Spreadsheet = require('edit-google-spreadsheet');
var mysql = require("mysql");
var geocoder = require('node-geocoder').getGeocoder("openstreetmap");;

// Open connection to mySQL database
var connection = mysql.createConnection({
	host: process.env.MYSQL_HOST || "localhost",
	user: process.env.MYSQL_USER || "root",
	password: process.env.MYSQL_PASSWORD || ""
});
connection.connect();



// Launch scraper
app.get("/scrape", function(request, response){
	
	var spreadsheet_username = process.env.SPREADSHEET_USERNAME;
	var spreadsheet_password = process.env.SPREADSHEET_PASSWORD;

	var completed = 0;
	var timeout = 0;

	// Pop open the source spreadsheet
	Spreadsheet.load({
		debug: true,
		spreadsheetName: "2016 Travel Tracker",
		worksheetName: "Sheet1",
		username: spreadsheet_username,
		password: spreadsheet_password
	}, function(err, spreadsheet){
		if( err ) throw err;
		spreadsheet.receive(function(err, rows, info) {

			// Cycle through spreadsheet and create new object
			var trips = makeObjectFromSpreadsheet(rows);

			// Truncate all tables and reset to nothing
			connection.query('TRUNCATE TABLE travel.candidates');
			connection.query('TRUNCATE TABLE travel.stops');
			connection.query('TRUNCATE TABLE travel.trips;');

			var added_cities = [];



			// Cycle through each "trip" row
			trips.forEach(function(trip){
				// This is my lil way of determining whether a row is undefined. There is probably a better way to do it.
				if (trip["First Name"]){
					// Insert candidate name into database (unless already exists)
					// But first, get rid of annoying extra spaces. Stupid Google Sheets. 
					name = trip["First Name"].replace(/\s/g, '') + " " + trip["Last Name"].replace(/\s/g, '');
					connection.query('INSERT IGNORE INTO travel.candidates (name, party) VALUES (?,?);', [name, trip["Party (R or D)"]], function(err, info) {
						if(err) throw err;
					});

					// Insert the actual trip
					connection.query('INSERT INTO travel.trips (candidate, start, end, total_days, accompanied_by, notes) VALUES (?,?,?,?,?,?)', 
						[name, moment( trip["Start Date (mm/dd/yy)"] ).format("YYYY-MM-DD"), moment( trip["End Date (mm/dd/yy)"] ).format("YYYY-MM-DD"), trip["Total Days"], trip["Appeared With (if more than one, use commas)"], trip["Notes"] ], 
					function(err, info) {

						// Save that tripid. 
						trip.tripid = info.insertId;

						// Let's add the city data. First let's loop through all the headers to find City references.
						for( city in trip ){
							(function(city, trip){
								if(trip.hasOwnProperty(city)){
									// If the column header mentions "City" (ie City 1, City 2)
									if(city.indexOf("City") != -1){
										completed--;
										console.log(trip[city] + " found: " + completed);
										// I use a little array test to see if we've already added a city to the database in this session.
										// It saves us from making a query sometimes.
										var was_city_added = added_cities.indexOf(trip[city] + ", " + trip["State (Abbrev.)"]);
										console.log("Was the city added? " + was_city_added);
										if( true ) {
											added_cities.push(trip[city] + ", " + trip["State (Abbrev.)"]);
											// See if the city already exists in the database
											connection.query('SELECT * FROM travel.places WHERE city = ? AND state = ?', [trip[city], trip["State (Abbrev.)"]], function(err, rows, header){
												if(err) throw err;

												// City already exists! Pop-U-lar. 
												if(rows.length > 0){
													// Now that that's settled, let's add the stop
													placeid = rows[0].id;
													connection.query('INSERT INTO travel.stops (tripid, placeid) VALUES (?,?)', [trip.tripid, placeid], function(){ 
														if( err ) throw err; 
														completed++;
														console.log(completed);

													});
												}
												else {
													console.log("Added " + trip[city]);													
													connection.query("INSERT IGNORE INTO travel.places (city, state) VALUES (?,?)", [trip[city], trip["State (Abbrev.)"]], function(err, info){
														if(err) throw err; 

														if( info.insertId == 0 ){
															connection.query('SELECT * FROM travel.places WHERE city = ? AND state = ?', [trip[city], trip["State (Abbrev.)"]], function(err, rows, header){
																if( err ) throw err;
																addStop(trip.tripid, rows[0].id);
															});
														} else {
															getLatLngs(trip[city], trip["State (Abbrev.)"]);
															addStop(trip.tripid, info.insertId);
														}

													})
												}
											});
										} 
									}
								}
							})(city, trip);
						//connection.query("INSERT INTO travel.cities ")
						}
					});
				}
			});
		});
	});

	function getLatLngs(city, state){
		// Pull lat/lng info from geocoder. But do it in a timeout so we don't overwhelm Ye Olde Geoparser
		setTimeout( function(){
			geocoder.geocode(city + ", " + state, function(err, res){
				console.log(res);
				if(err) throw err;
				// Did we actually get a geocoding result?
				if( res.length == 0 || !res[0] ) res.push({"latitude": 0, "longitude": 0})

				// Add it to the database
				connection.query("UPDATE travel.places SET lat = ?, lng = ? WHERE city = ? AND state = ?", [parseFloat(res[0].latitude), parseFloat(res[0].longitude), city, state], function(err, info){ 
					if(err) throw err;
				});
			});
		}, timeout * 500);
		timeout++;

	}

	function findPlace(city, state){
		connection.query('SELECT * FROM travel.places WHERE city = ? AND state = ?', [city, state], function(err, rows, header){
			if( err ) throw err;
			return rows;
		});
	}

	function addStop(tripid, placeid){
		connection.query('INSERT INTO travel.stops (tripid, placeid) VALUES (?,?)', [tripid, placeid], function(err, info){ 
			if( err ) throw err; 
			completed++;
			console.log(completed);
		});
	}

	function makeObjectFromSpreadsheet(rows){
		export_array = [];
		fields = [];
		for( var row in rows ){
			if( rows.hasOwnProperty(row) ){
				var object = {};
				for( var column in rows[row] ){
					if( rows[row].hasOwnProperty(column) ){
						if( row == "1" ){
							fields.push(rows[row][column]);
						}
						else {
							object[fields[column - 1]] = rows[row][column];
						}
					}
				}
				export_array.push(object);
			}
		}
		return export_array;
	}
});

