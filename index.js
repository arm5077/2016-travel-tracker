var express = require("express");
var app = express();
var moment = require('moment');
var Spreadsheet = require('edit-google-spreadsheet');
var mysql = require("mysql");
var geocoder = require('node-geocoder').getGeocoder("openstreetmap");;
var apicache = require('apicache').options({ debug: true }).middleware;
var firstBy = require('thenBy.js');


// Turn on server
var port = process.env.PORT || 3000;
app.listen(port, function(){
	console.log("We're live at port " + port + ".");
});

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
}
app.use(allowCrossDomain);


// Set up static page (main page)
app.use("/", express.static(__dirname + "/public/"));

// Set up static page (map screen)
app.use("/map", express.static(__dirname + '/public/map'));

// Assets endpoint
app.use("/assets", express.static(__dirname + '/public/assets'));

app.get("/api/candidates", apicache("5 minutes"), function(request, response){
	var results = [];
	var pending = 0;
	var connection = connectMySQL();

	connection.query("SELECT trips.tripid, trips.candidate, candidates.party, places.city, trips.state, accompanied_by, notes, start \
					FROM (SELECT * FROM trips ORDER BY start DESC) as trips \
					JOIN candidates on candidates.name=trips.candidate \
					JOIN (select * from stops ORDER BY tripid DESC) as stops on stops.tripid = trips.tripid \
					JOIN places on stops.placeid=places.id \
					GROUP BY candidate ORDER BY candidate", 
	function(err, rows, header){	
		if(err) throw err;
		rows.forEach(function(candidate){
			pending++;
			
			// Get state by state count
			connection.query("select state, count(state) as count from trips WHERE candidate=? GROUP BY state order by count DESC limit 5", [candidate.candidate], function(err, trips, header){
				if(err) throw err;
				pending--;
				pending++;
				connection.query("SELECT candidate, COUNT(*) as trips FROM trips WHERE candidate = ?", [candidate.candidate], function(err, count, header){
					pending--;
					results.push({"name": candidate.candidate, party: candidate.party, total: count[0].trips, "last-seen": candidate, "most-visited": trips});
					if(pending <= 0) {
						console.log("closing connection");
						connection.end();
						response.status(200).json({ count: rows.length, results: results });
					}
				});		
			});
		});	
	});
});

app.get("/api/widget", function(request, response){
	var connection = connectMySQL();
	
	connection.query("SELECT * FROM trips JOIN stops ON trips.tripid = stops.tripid JOIN places ON stops.placeid = places.id WHERE start <= '" + moment( new Date() ).format("YYYY-MM-DD") + "' ORDER BY start DESC, stops.id ASC LIMIT 20", function(err, rows, header){

		// Cycle through and aggregate on tripid
		var trips = [];
		
		rows.forEach(function(row){
			var tripIndex = trips.map(function(d){ return d.tripid }).indexOf(row.tripid);
			if( tripIndex == -1 ){
				trips.push({ tripid: row.tripid, candidate: row.candidate, date: row.start, state: row.state, notes: row.notes, stops:[], stopCount: 0 });
				tripIndex = trips.length - 1
			}
			trips[tripIndex].stops.push({ city: row.city, state: row.state });
			trips[tripIndex].stopCount++;
		});
		
		// Sort by date and number of trips
		trips.sort(
			firstBy(function(a, b){
				return b.date - a.date
			})
			.thenBy("stopCount", -1)
		)
		
		response.status(200).json({ results: trips });
		

	});
	
});

app.get("/api/trips", apicache('5 minutes'), function(request, response){
	
	var connection = connectMySQL();
	
	var result = {};
	var params = "";
	
	console.log(request.query);
	
	// As of now, you need to specify a candidate to search for
	if( !request.query.candidates ){
		connection.end()
		console.log("closing connection");
		response.status(200).json({ count: 0, results: [], params: request.query });
	}
	else {
		// Handle query parameters
		if( request.query.start ){
			params += " AND start >=" + connection.escape(moment( new Date(request.query.start) ).format("YYYY-MM-DD")); 
		} else {
			// Default to returning results from within the past week.
			params += " AND start >=" + connection.escape(moment( new Date(request.query.start) ).subtract(7,"days").format("YYYY-MM-DD"))
		}
		if( request.query.end )
			params += " AND end <=" + connection.escape(moment( new Date(request.query.end) ).format("YYYY-MM-DD"));
		if( request.query.state && request.query.state != "*" )	
			params += " AND state = " + connection.escape( request.query.state );
		if( request.query.candidates) {
			params += " AND (";
			candidates = request.query.candidates.split(",");
			candidates.forEach(function(candidate){
				params += " REPLACE(candidate, ' ', '') = " + connection.escape(candidate) + " OR"; 
			});
				params = params.slice(0,-3);
				params += ")";

		}

		query_string = "SELECT * FROM trips WHERE 1=1" + params + " ORDER BY start DESC";

		connection.query(query_string, function(err, rows, header){
			if( err ) throw err;
			console.log("yoyoyo");
			console.log(rows);
			if( rows.length == 0 ){
				connection.end();
				response.status(200).json({ count: rows.length, results: rows, params: request.query });
				console.log("closing connection");

			}
			else {
				var queryCount = 0;
				rows.forEach(function(trip){
					queryCount++; 
					connection.query("SELECT stops.id, places.id as placeid, places.city, places.state, places.lat, places.lng FROM stops JOIN places ON stops.placeid = places.id WHERE tripid = ? ORDER BY stops.id ASC", [trip.tripid], function(err, stops, header){
						if( err ) throw err;
						trip.stops = stops;
						queryCount--;
						if( queryCount <= 0 ) {
							connection.end();
							console.log("closing connection");
							response.status(200).json({ count: rows.length, results: rows, params: request.query });
						}
					});
				});
			}

		});
		
		
	}
	
	
});



// Launch scraper
app.get("/scrape", function(request, response){	
	
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
					response.status(200).json({ message: "done" });
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
	
	
});


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
