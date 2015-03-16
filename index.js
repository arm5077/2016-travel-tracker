var express = require("express");
var app = express();
var moment = require('moment');
var Spreadsheet = require('edit-google-spreadsheet');
var mysql = require("mysql");
var geocoder = require('node-geocoder').getGeocoder("openstreetmap");;

var connection = mysql.createConnection({
	host: process.env.MYSQL_HOST || "localhost",
	user: process.env.MYSQL_USER || "root",
	password: process.env.MYSQL_PASSWORD || ""
});

connection.connect();

var spreadsheet_username = process.env.SPREADSHEET_USERNAME;
var spreadsheet_password = process.env.SPREADSHEET_PASSWORD;

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
		var timeout = 0;

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
						
						// Let's add the city data. First let's loop through all the headers to find City references.
						for( city in trip ){
							(function(city, trip){
								if(trip.hasOwnProperty(city)){
						
									// If the column header mentions "City" (ie City 1, City 2)
									if(city.indexOf("City") != -1){
				
										// I use a little array test to see if we've already added a city to the database in this session.
										// It saves us from making a query sometimes.
										var was_city_added = added_cities.indexOf(trip[city] + ", " + trip["State (Abbrev.)"]);
										if( was_city_added == -1) {
											added_cities.push(trip[city] + ", " + trip["State (Abbrev.)"]);
											
											// See if the city already exists in the database
											connection.query('SELECT * FROM travel.places WHERE city = ? AND state = ?', [trip[city], trip["State (Abbrev.)"]], function(err, rows, header){
												if(err) throw err;
												if(rows.length > 0){
											
												}
												else {
													console.log("Added " + trip[city]);													
													connection.query("INSERT INTO travel.places (city, state) VALUES (?,?)", [trip[city], trip["State (Abbrev.)"]], function(err, info){
														if(err) throw err; 
														
														// Pull lat/lng info from geocoder. But do it in a timeout so we don't overwhelm Ye Olde Geoparser
														setTimeout( function(){
															geocoder.geocode(trip[city] + ", " + trip["State (Abbrev.)"], function(err, res){
																console.log(res);
																console.log("Got lat lng for " + trip[city]);
																if(err) throw err;
																if(res.length > 0){
																	console.log("UPDATE travel.places SET lat = " + parseFloat(res[0].latitude) + ", lng = " + parseFloat(res[0].longitude) + " WHERE city = '" + trip[city] + "' AND state = '" + trip["State (Abbrev.)"] + "'");											
																	connection.query("UPDATE travel.places SET lat = ?, lng = ? WHERE city = ? AND state = ?", [parseFloat(res[0].latitude), parseFloat(res[0].longitude), trip[city], trip["State (Abbrev.)"]], function(err, info){ if(err) throw err});
																	
																}
															}, timeout * 500);
															timeout++;
															console.log(timeout);
														})
														
													
													});
											
											
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
		
			//connection.end();
		
	});
});
		
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