var express = require("express");
var moment = require('moment');
var Spreadsheet = require('edit-google-spreadsheet');
var mysql = require("mysql");
var geocoder = require('node-geocoder').getGeocoder("openstreetmap");;

var connection = connectMySQL();

var spreadsheet_email = process.env.SPREADSHEET_EMAIL;
var spreadsheet_key = process.env.SPREADSHEET_KEY;

var completed = 0;
var outstanding = 0;
var timeout = 0;


// Pop open the source spreadsheet
Spreadsheet.load({
	debug: true,
	spreadsheetId: "1Aw-7f9eqTlE7TcHvdK8qwBF3bioLrk_H2TNzXA5wVzM",
	worksheetName: "Sheet1",
	oauth: {
		email: spreadsheet_email,
		key: spreadsheet_key
	}
}, function(err, spreadsheet){
	if( err ) throw err;
	spreadsheet.receive(function(err, rows, info) {
		if( err ) throw err;
		
		// Cycle through spreadsheet and create new object
		var trips = makeObjectFromSpreadsheet(rows);

		// Truncate all tables and reset to nothing
		connection.query('SET @MAX_QUESTIONS=20000', function(err, rows, header){ console.log("reset question limit"); if( err ) throw err; });
		connection.query('TRUNCATE TABLE candidates', function(err, rows, header){ console.log("truncated candidates"); if( err ) throw err; });
		connection.query('TRUNCATE TABLE stops', function(err, rows, header){ console.log("truncated stops"); if( err ) throw err; });
		connection.query('TRUNCATE TABLE trips;', function(err, rows, header){ console.log("truncated trips");  if( err ) throw err; });
		connection.query('DELETE FROM places WHERE lat IS NULL OR lat = 0;', function(err, rows, header){ console.log("deleted empty places");  if( err ) throw err; });

		var added_cities = [];
		
		// Start checker to see if we're done computing
		var success = 0;
		var checker = setInterval(function(){
			console.log(outstanding);
			if( outstanding === 0 )
				success++;
			else
				success = 0;

			if( success == 5 ){
				connection.end();
				clearInterval(checker);
			}

		},1000);
	
		// Cycle through each "trip" row
		trips.forEach(function(trip){
			// This is my lil way of determining whether a row is undefined. There is probably a better way to do it.
			if (trip["First Name"] && moment( new Date(trip["Start Date (mm/dd/yy)"]) ) <= moment(new Date()) ){
				
				// Insert candidate name into database (unless already exists)
				// But first, get rid of annoying extra spaces. Stupid Google Sheets. 
				name = trip["First Name"].replace(/\s/g, '') + " " + trip["Last Name"].replace(/\s/g, '');
				
				connection.query('INSERT IGNORE INTO candidates (name, party) VALUES (?,?);', [name, trip["Party (R or D)"]], function(err, info) {
					if(err) throw err;
				});

				// Insert the actual trip
				outstanding++;
				connection.query('INSERT INTO trips (candidate, state, start, end, total_days, accompanied_by, notes) VALUES (?,?,?,?,?,?,?)', 
					[name, trip["State (Abbrev.)"], moment( new Date(trip["Start Date (mm/dd/yy)"]) ).format("YYYY-MM-DD"), moment( new Date(trip["End Date (mm/dd/yy)"]) ).format("YYYY-MM-DD"), trip["Total Days"], trip["Appeared With (if more than one, use commas)"], trip["Notes"] ], 
				function(err, info) {

					if( err ) throw err;
					
					outstanding--;
					
					// Save that tripid. 
					trip.tripid = info.insertId;

					// Let's add the city data. First let's loop through all the headers to find City references.
					for( city in trip ){
						(function(city, trip){
							if(trip.hasOwnProperty(city)){
								// If the column header mentions "City" (ie City 1, City 2)
								if(city.indexOf("City") != -1){
									// I use a little array test to see if we've already added a city to the database in this session.
									// It saves us from making a query sometimes.
									var was_city_added = added_cities.indexOf(trip[city] + ", " + trip["State (Abbrev.)"]);
									if( true ) {

										added_cities.push(trip[city] + ", " + trip["State (Abbrev.)"]);
										// See if the city already exists in the database
										outstanding++;
										connection.query('SELECT * FROM places WHERE city = ? AND state = ?', [trip[city], trip["State (Abbrev.)"]], function(err, rows, header){
											if(err) throw err;
											outstanding--;
											// City already exists! Pop-U-lar. 
											if(rows.length > 0){
												// Now that that's settled, let's add the stop
												placeid = rows[0].id;
												outstanding++;
												connection.query('INSERT INTO stops (tripid, placeid) VALUES (?,?)', [trip.tripid, placeid], function(){ 
													if( err ) throw err; 
													completed++;
													outstanding--;
													if( completed == 0 ){

													}
												});
											}
											else {
												outstanding++;
												connection.query("INSERT IGNORE INTO places (city, state) VALUES (?,?)", [trip[city], trip["State (Abbrev.)"]], function(err, info){
													if(err) throw err; 
													outstanding--;
													if( info.insertId == 0 ){
														outstanding++;
														connection.query('SELECT * FROM places WHERE city = ? AND state = ?', [trip[city], trip["State (Abbrev.)"]], function(err, rows, header){
															if( err ) throw err;
															outstanding--;
															addStop(trip.tripid, rows[0].id);
														});
													} else {
														completed--;
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
	outstanding++;
	setTimeout( function(){
		geocoder.geocode(city + ", " + state, function(err, res){
			if(err) throw err;
			outstanding--;
			// Did we actually get a geocoding result?
			if( res.length == 0 || !res[0] ) res.push({"latitude": 0, "longitude": 0})

			// Add it to the database
			outstanding++;
			connection.query("UPDATE places SET lat = ?, lng = ? WHERE city = ? AND state = ?", [parseFloat(res[0].latitude), parseFloat(res[0].longitude), city, state], function(err, info){ 
				if(err) throw err;
				completed++;
				outstanding--
			});
		});
	}, timeout * 500);
	timeout++;

}

function findPlace(city, state){
	connection.query('SELECT * FROM places WHERE city = ? AND state = ?', [city, state], function(err, rows, header){
		if( err ) throw err;
		return rows;
	});
}

function addStop(tripid, placeid){
	connection.query('INSERT INTO stops (tripid, placeid) VALUES (?,?)', [tripid, placeid], function(err, info){ 
		if( err ) throw err; 
		completed++;
		if(completed == 0) {

		}

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

function connectMySQL(){
// Open connection to mySQL database
var connection = mysql.createConnection(process.env.CLEARDB_DATABASE_URL || "mysql://root@localhost/travel");
connection.on("error", function(err){  
	connection.end();
	 return setTimeout(function(){ return connectMySQL() },3000);
});

connection.connect( function(err){ if(err) throw err; });

return connection;
}
