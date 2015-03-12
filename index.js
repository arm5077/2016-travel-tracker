var express = require("express");
var app = express();
var moment = require('moment');
var Spreadsheet = require('edit-google-spreadsheet');
var mysql = require("mysql");
var geocoder = require('node-geocoder').getGeocoder("google");;

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

		trips.forEach(function(trip){
			if (trip["First Name"]){
				
				// Insert candidate name into database (unless already exists)
				name = trip["First Name"].replace(/\s/g, '') + " " + trip["Last Name"].replace(/\s/g, '');
				connection.query('INSERT IGNORE INTO travel.candidates (name, party) VALUES (?,?);', [name, trip["Party (R or D)"]], function(err, info) {
					if(err) throw err;
				});
				
				// Insert trip
				connection.query('INSERT INTO travel.trips (candidate, start, end, total_days, accompanied_by, notes) VALUES (?,?,?,?,?,?)', 
					[name, moment( trip["Start Date (mm/dd/yy)"] ).format("YYYY-MM-DD"), moment( trip["End Date (mm/dd/yy)"] ).format("YYYY-MM-DD"), trip["Total Days"], trip["Appeared With (if more than one, use commas)"], trip["Notes"] ], 
					function(err, info) {
						for( i=1; i<=15; i++){
							//connection.query("INSERT INTO travel.cities ")
						}
					});
			}
		});
		
			connection.end();
		
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