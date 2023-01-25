const { Pool, Client } = require('pg')
const st = require('simpletype-js')

var globals = {
	consoleLogQueries: false,
}


module.exports = {
	DBLink: class {
		constructor(options, callback) {
			//check for host, username, and password
			let tcheck = st.checkSync({ host: "string", user: "string", password: "string" }, options)
			if (tcheck.correct) {
			//if (typeof(options.host) == "string" && typeof(options.user) == "string" && typeof(options.password) == "string") {
				this.user = options.user
				if (options.mode) { delete options.mode } //clear the mode setting from the options object, so it doesnt go to the database 
				//all clear for this.pool creation
				try {
					var defaultOptions = {
						database: "postgres",
						port: 5432,
						max: 20,
						idleTimeoutMillis: 30000,
						connectionTimeoutMillis: 2000,
					}
					
					//merge defaults with passed options
					options = {
						...defaultOptions,
						...options,
					}
					//this.options = options

					//create this.pool
					this.pool = new Pool(options);
					//add CRUD and utility methods
					this.create = {
						schema: async (opts) => {
							var defaults = {
								overwrite: false
							}
							var options
							if (opts) { options = processOptions(opts, defaults) } else {options = defaults}
			
							//CREATE SCHEMA IF NOT EXISTS schema_adrauth
							var query = ``;
							if (options.overwrite) {
								query += `CREATE SCHEMA ${options.schema}`;
							} else {
								query += `CREATE SCHEMA IF NOT EXISTS ${options.schema}`;
							}
							log(query)
							var queryRes = await dbQuery(this.pool, query)
							return queryRes
						},
						table: async (opts) => {
							var options = processOptions({
								schema: "public",
							}, opts)
							//CREATE SCHEMA IF NOT EXISTS schema_adrauth
							var valueSet = await processCols(options.cols, options.name)

							var query = `CREATE TABLE "${options.schema}".${options.name} ( ${valueSet.queryCols} );`;
							log(query)
							var queryRes = await dbQuery(this.pool, query)
							return queryRes
						},
						record: async (dataObject, opts) => {
							let tcheck = st.checkSync({ dataObject: "object", table: "string", password: "string" }, {dataObject, ...options})
							if (tcheck.correct) {
								try {
									var options = processOptions({
										schema: "public",
									}, opts)
									//dataObject keys will become columns, dataObject values will be written to those columns
									//make sure <dataObject> is an actual dataObject
									
									var valueSet = await processValues(dataObject)
									var query = `INSERT INTO ${options.schema}.${options.table}(${valueSet.cols}) VALUES (${valueSet.valDollars});`;
									log(query)
									var queryRes = await dbQuery(this.pool, query, valueSet.valArray)
									return queryRes
									
								} catch (err) {
									throw err
									
								}
							} else {
								throw tcheck.failed
							}
						},
					}

					this.get = {
						records: async (opts) => {
							try {
								var options = processOptions({
									schema: "public",
								}, opts)
								//object keys will become columns, object values will be written to those columns
								//make sure <object> is an actual object
								if (typeof(options.table) == "string") {
									//no selection cases provided, select all from requested table
									var query = `SELECT * FROM ${options.schema}.${options.table}`;
									
									var queryRes = await dbQuery(this.pool, query)
									return processResponse(queryRes)
			
								} else {
									//table name was not string
									throw `options.table must be of type 'string', got '${typeof(options.table)}'.`
								}
							} catch (err) {
								//general error occurred, in the whole try{}catch block
								throw err
							}
							
						},
						recordsWhere: async (whereCases, opts) => {
							try {
								var options = processOptions({
									schema: "public",
								}, opts)
								//object keys will become columns, object values will be written to those columns
								//make sure <object> is an actual object
								if (typeof(options.table) == "string") {
									var valueSet = await processCases(whereCases, options.opArray)
									//valueSet is an object that contains:
									//valueSet.valArray: the Array that actually contains the data to be filtered
									//valueSet.valCases: literal SQL/native query string representing the templated $ values, to be inserted into the query
									var query = `SELECT * FROM ${options.schema}.${options.table} WHERE ${valueSet.valCases};`;
									log(query)
									var queryRes = await dbQuery(this.pool, query, valueSet.valArray)
									return processResponse(queryRes)

			
								} else {
									//table name was not string
									throw `options.table must be of type 'string', got '${typeof(options.table)}'.`
								}
							} catch (err) {
								//general error occurred, in the whole try{}catch block
								throw err
							}
						},
						cols: async (cols, opts) => {
							try {
								var options = processOptions({
									schema: "public",
									opArray: null,
								}, opts)
								
								var query = `SELECT ${cols} FROM ${options.schema}.${options.table}`;
			
								var queryRes = await dbQuery(this.pool, query)
								return processResponse(queryRes)

							} catch (err) {
								throw err
							}
						},
						colsWhere: async (cols, whereCases, opts) => {
							try {
								var options = processOptions({
									schema: "public",
									opArray: null,
								}, opts)
								//object keys will become columns, object values will be written to those columns
								//make sure <object> is an actual object
								var valueSet = await processCases(whereCases, options.opArray)
								var query = `SELECT ${cols} FROM ${options.schema}.${options.table} WHERE ${valueSet.valCases};`;
								log(query)
								var queryRes = await dbQuery(this.pool, query, valueSet.valArray)
								return processResponse(queryRes)

							} catch (err) {
								throw err
							}
						}
					}

					this.update = {
						recordsWhere: async (values, whereCases, opts) => {
								try {
									var options = processOptions({
										schema: "public",
										opArray: null,
									}, opts)
									//object keys will become columns, object values will be written to those columns
									//make sure <object> is an actual object
									if (typeof(options.table) == "string") {
										if (typeof(values) == "object" && !Array.isArray(values)) {
											if (typeof(whereCases) == "object" && !Array.isArray(whereCases)) {
												var valueSet = await processCasesWithValues(whereCases, options.opArray, values)
												//var query = `SELECT ${cols} FROM ${table} WHERE ${valueSet.valCases};`;
												var query = `UPDATE ${options.schema}.${options.table} SET ${valueSet.valValues} WHERE ${valueSet.valCases}`
												log(query)
												var queryRes = await dbQuery(this.pool, query, valueSet.valArray)
												return processResponse(queryRes)

											} else {
												var valueSet = await processCasesWithValues(whereCases, options.opArray, values)
												//var query = `SELECT ${cols} FROM ${table} WHERE ${valueSet.valCases};`;
												var query = `UPDATE ${options.schema}.${options.table} SET ${valueSet.valValues}`
												log(query)
												var queryRes = await dbQuery(this.pool, query, valueSet.valArray)
												return processResponse(queryRes)
												
												
											}
										} else {
											throw `First argument must be of type 'object', got '${typeof(values)}'.`
										}
									} else {
										throw `options.table must be of type 'string', got '${typeof(options.table)}'.`
									}
								} catch (err) {
									throw err
								}
						},
						incDecAll: async (inc, column, opts) => {
							try {
								var options = processOptions({
									schema: "public",
									opArray: null,
								}, opts)
								//object keys will become columns, object values will be written to those columns
								//make sure <object> is an actual object
								var query = `UPDATE ${options.schema}.${options.table} SET ${column} = ${column} + ${inc};`
								log(query)
								var queryRes = await dbQuery(this.pool, query)
								return processResponse(queryRes)
									
							} catch (err) {
								throw err
							}
						},
						incDecWhere: async (inc, column, cases, opts) => {
								try {
									var options = processOptions({
										schema: "public",
										opArray: null,
									}, opts)
									//object keys will become columns, object values will be written to those columns
									//make sure <object> is an actual object
									var valueSet = await processCases(cases, options.opArray)
									var query = `UPDATE ${options.schema}.${options.table} SET ${column} = ${column} + ${inc} WHERE ${valueSet.valCases};`
									log(query)
									var queryRes = await dbQuery(this.pool, query, valueSet.valArray)
									return processResponse(queryRes)
										
								} catch (err) {
									throw err
								}
						},
					}

					this.delete = {
						schema: async (opts) => {
							var defaults = { overwrite: false }
							var options = processOptions({
								overwrite: false,
							}, opts)

							var query = ``;
							if (options.overwrite) {
								query += `DROP SCHEMA ${options.schema}`;
							} else {
								query += `DROP SCHEMA IF EXISTS ${options.schema}`;
							}
							log(query)
							var queryRes = await dbQuery(this.pool, query)
							return processResponse(queryRes)
						},
						table: async (opts) => {
							var options = processOptions({
								schema: "public",
							}, opts)
							//CREATE SCHEMA IF NOT EXISTS schema_adrauth
							var query = `DROP TABLE "${options.schema}".${options.name};`;
							log(query)
							var queryRes = await dbQuery(this.pool, query)
							return processResponse(queryRes)
						},
						record: async (whereCases, opts) => {
							try {
								var options = processOptions({
									schema: "public",
									opArray: null
								}, opts)
								//object keys will become columns, object values will be written to those columns
								//make sure <object> is an actual object
								if (typeof(whereCases) == "object" && !Array.isArray(whereCases)) {
									if (typeof(options.table) == "string") {
										var valueSet = await processCases(whereCases, options.opArray)
										var query = `DELETE FROM ${options.schema}.${options.table} WHERE ${valueSet.valCases};`;
										log(query)
										var queryRes = await dbQuery(this.pool, query, valueSet.valArray)
										return processResponse(queryRes)
			
									} else {
										throw `options.table must be of type 'string', got '${typeof(options.table)}'.`
									}
								} else {
									throw `Second argument must be of type 'object', got '${typeof(whereCases)}'.`
								}
							} catch (err) {
								throw err
							}
						},
					}

					this.list = {
						
						schemas: async (opts) => {
							var defaults = {
							}
							var options
							if (opts) { options = processOptions(opts, defaults) } else {options = defaults}
							//SELECT schema_name FROM information_schema.schemata;
							var query = `SELECT schema_name FROM information_schema.schemata;`
							var queryRes = await dbQuery(this.pool, query)
							return processResponse(queryRes)
						},
						tables: async (opts) => {
							var options = processOptions({
								schema: "public",
							}, opts)
							//SELECT * FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';
							var query = ""
							if (options.schema) {
								//return all tables in schema
								query = `SELECT * FROM pg_catalog.pg_tables WHERE schemaname = '${options.schema}';`
							} else {
								//return all tables in ALL schemas
								query = `SELECT * FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';`
							}
							var queryRes = await dbQuery(this.pool, query)
							return processResponse(queryRes)
						},
						columns: async (opts) => {
							var options = processOptions({
								schema: "public",
							}, opts)
							//SELECT * FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';
							var query = `SELECT * FROM information_schema.columns WHERE table_schema = '${options.schema}' AND table_name = '${options.table}';`
							var queryRes = await dbQuery(this.pool, query)
							return processResponse(queryRes)
						},
					}

					this.count = {
						tables: async (opts) => {
							try {
								var options = processOptions({
									schema: "public",
								}, opts)
								//object keys will become columns, object values will be written to those columns
								//make sure <object> is an actual object
								var query = ""
								if (options.schema) {
									//return all tables in schema
									query = `SELECT count(*) FROM information_schema.tables WHERE table_schema = '${options.schema}';`
								} else {
									//return all tables in ALL schemas
									query = `select count(*) from information_schema.tables where table_type = 'BASE TABLE';`
								}

								var queryRes = await dbQuery(this.pool, query)
								return parseFloat(queryRes.rows[0].count)
							} catch (err) {
								throw err
							}
						},
						schemas: async (opts) => {
							var options = processOptions({
							}, opts)
							//SELECT schema_name FROM information_schema.schemata;
							var query = `SELECT count(schema_name) FROM information_schema.schemata;`
							var queryRes = await dbQuery(this.pool, query)
							return parseFloat(queryRes.rows[0].count)
						},
						rowsEstimate: async (opts) => {
							try {
								var options = processOptions({
									schema: "public",
								}, opts)
								//object keys will become columns, object values will be written to those columns
								//make sure <object> is an actual object
								if (typeof(options.table) == "string") {
									var query = `SELECT reltuples AS estimate FROM pg_class WHERE relname = '${options.schema}.${options.table}';`;
									log(query)
									var queryRes = await dbQuery(this.pool, query, valueSet.valArray)
									return queryRes
									
								} else {
									throw `options.table must be of type 'string', got '${typeof(options.table)}'.`
								}
							} catch (err) {
								throw err
							}
						},
						rows: async (opts) => {
							try {
								var options = processOptions({
									schema: "public",
								}, opts)
								//object keys will become columns, object values will be written to those columns
								//make sure <object> is an actual object
								if (typeof(options.table) == "string") {
									var query = `SELECT count(*) FROM ${options.schema}.${options.table};`;
									log(query)
									var queryRes = await dbQuery(this.pool, query, valueSet.valArray)
									return queryRes
									
								} else {
									throw `options.table must be of type 'string', got '${typeof(options.table)}'.`
								}
							} catch (err) {
								throw err
							}
						},
					}

					this.utils = {
						primKey: {
							correctNext: async (opts) => {
								try {
									//this function heals numeric primary key sequences when they error irrationally after things like backup-loads
									var options = processOptions({
										schema: "public",
									}, opts)

									// Step 1) Get the primary key of the requested table
									var query = `SELECT string_agg(a.attname, ', ') AS pk
													FROM
														pg_constraint AS c
														CROSS JOIN LATERAL UNNEST(c.conkey) AS cols(colnum) -- conkey is a list of the columns of the constraint; so we split it into rows so that we can join all column numbers onto their names in pg_attribute
														INNER JOIN pg_attribute AS a ON a.attrelid = c.conrelid AND cols.colnum = a.attnum
													WHERE
														c.contype = 'p' -- p = primary key constraint
														AND c.conrelid = '${options.schema}.${options.table}'::REGCLASS;`

									//log(query)
									var DBprimKey = await dbQuery(this.pool, query)
									var primKey = DBprimKey.rows[0].pk
									// Step 2) Check max number in <prim key> column of the table
									var maxKey = (await dbQuery(this.pool, `SELECT MAX(${primKey}) FROM ${options.schema}.${options.table};`)).rows[0].max
									// Step 3) The next primkey number should be one higher than the max value,
									// 	if it is not, set the next key value to the current max number, so the next value will be the next number after the following query increments it
									var queryRes = await dbQuery(this.pool, `SELECT setval('${options.schema}."${options.table}_${primKey}_seq"', ${parseInt(maxKey)});`)
									return processResponse(queryRes)
								} catch (err) {
									throw err
								}
								
							},
						}
					}

					//callback to allDB
					callback(null, "DBLink created")
				} catch (err) {
					callback(err)
				}
			} else {
				callback(tcheck.failed)
				//callback("one or more input parameters were incorrect")
			}
		}
		disconnect() {
			this.pool.end()
			.then(() => {
				//pool has been disconnected
				return null
			})
			.catch(err => {
				throw err
			})
		}
	},
};


function processCases(cases, opArray) {
    return new Promise((resolve, reject) => {
        var oaIncrement = 0;
        var valDollarIncrement = 1;
        var valArray = [];
        var valCases = "";

        if (typeof(cases) == "object" && !Array.isArray(cases)) {
            var casesArr = Object.keys(cases);
            if (casesArr.length > 1) {
                //iterate through all keys
                for (var ncase of casesArr) {
                    if (ncase == casesArr[casesArr.length-1]) {
                        //this is the last ncase
                        if (opArray) {
                            if (Array.isArray(opArray)) {
                                //an operator array was passed, and it is actually an array
                                if (typeof(opArray[oaIncrement]) == "string") {
                                    valCases += `${ncase} ${opArray[oaIncrement]} ` + "$" + valDollarIncrement;
                                    valArray.push(cases[ncase]);
                                    valDollarIncrement++;
                                    oaIncrement++;
                                } else {
                                    //all opArray items must be string
                                    reject(`[ERR: ${fName}] All values in third argument array must be string.`);
                                }
                            } else {
                                //opArray must be array
                                reject(`[ERR: ${fName}] If third argument is used, it must be an array. Got '${typeof(opArray)}'.`);
                            }
                        } else {
                            //no opArray was passed at all, or it was falsy
                            valCases += `${ncase} = ` + "$" + valDollarIncrement;
                            valArray.push(cases[ncase]);
                            valDollarIncrement++;
                        }
                    } else {
                        //this is *not* the last ncase
                        if (opArray) {
                            if (Array.isArray(opArray)) {
                                //an operator array was passed, and it is actually an array
                                if (typeof(opArray[oaIncrement]) == "string") {
                                    valCases += `${ncase} ${opArray[oaIncrement]} ` + "$" + valDollarIncrement + " AND ";
                                    valArray.push(cases[ncase]);
                                    valDollarIncrement++;
                                    oaIncrement++;
                                } else {
                                    //all opArray items must be string
                                    reject(`[ERR: ${fName}] All values in third argument array must be string.`);
                                }
                            } else {
                                //opArray must be array
                                reject(`[ERR: ${fName}] If third argument is used, it must be an array. Got '${typeof(opArray)}'.`);
                            }
                        } else {
                            //no opArray was passed at all, or it was falsy
                            valCases += `${ncase} = ` + "$" + valDollarIncrement + " AND ";
                            valArray.push(cases[ncase]);
                            valDollarIncrement++;
                            
                        }
                    }
                }
            } else {
                //only one ncase, no need to loop
                if (opArray && Array.isArray(opArray)) {
                    valCases = `${casesArr[0]} ${opArray[0]} ` + "$1";
                    valArray.push(cases[casesArr[0]]);
                } else {
                    valCases = `${casesArr[0]} = ` + "$1";
                    valArray.push(cases[casesArr[0]]);
                }
            }

			resolve({doCases: true, valArray, valCases})

        } else {
            resolve({doCases: false})
        }
    }) 
}

function processCasesWithValues(cases, opArray, values) {
    return new Promise((resolve, reject) => {
		var oaIncrement = 0;
		var valDollarIncrement = 1;
		var valArray = [];
		var valCases = "";
		var valValues = "";
		
		if (typeof(cases) == "object" && !Array.isArray(cases)) {
			//cases is set
			var casesArr = Object.keys(cases);
			if (casesArr.length > 1) {
				//iterate through all keys
				for (var ncase of casesArr) {
					if (ncase == casesArr[casesArr.length-1]) {
						//this is the last ncase
						if (opArray) {
							if (Array.isArray(opArray)) {
								//an operator array was passed, and it is actually an array
								if (typeof(opArray[oaIncrement]) == "string") {
									valCases += `${ncase} ${opArray[oaIncrement]} ` + "$" + valDollarIncrement;
									valArray.push(cases[ncase]);
									valDollarIncrement++;
									oaIncrement++;
								} else {
									//all opArray items must be string
									reject(`[ERR: ${fName}] All values in third argument array must be string.`);
								}
							} else {
								//opArray must be array
								reject(`[ERR: ${fName}] If fourth argument is used, it must be an array. Got '${typeof(opArray)}'.`);
							}
						} else {
							//no opArray was passed at all, or it was falsy
							valCases += `${ncase} = ` + "$" + valDollarIncrement;
							valArray.push(cases[ncase]);
							valDollarIncrement++;
						}
					} else {
						//this is *not* the last ncase
						if (opArray) {
							if (Array.isArray(opArray)) {
								//an operator array was passed, and it is actually an array
								if (typeof(opArray[oaIncrement]) == "string") {
									valCases += `${ncase} ${opArray[oaIncrement]} ` + "$" + valDollarIncrement + " AND ";
									valArray.push(cases[ncase]);
									valDollarIncrement++;
									oaIncrement++;
								} else {
									//all opArray items must be string
									reject(`[ERR: ${fName}] All values in third argument array must be string.`);
								}
							} else {
								//opArray must be array
								reject(`[ERR: ${fName}] If fourth argument is used, it must be an array. Got '${typeof(opArray)}'.`);
							}
						} else {
							//no opArray was passed at all, or it was falsy
							valCases += `${ncase} = ` + "$" + valDollarIncrement + " AND ";
							valArray.push(cases[ncase]);
							valDollarIncrement++;
							
						}
					}
				}
			} else {
				//only one ncase, no need to loop
				if (opArray && Array.isArray(opArray)) {
					valCases = `${casesArr[0]} ${opArray[0]} ` + "$" + valDollarIncrement;
					valArray.push(cases[casesArr[0]]);
					valDollarIncrement++;
				} else {
					valCases = `${casesArr[0]} = ` + "$" + valDollarIncrement;
					valArray.push(cases[casesArr[0]]);
					valDollarIncrement++;
				}
			}
		}
		
		var keysArr = Object.keys(values);
		if (keysArr.length > 1) {
			//iterate through all keys
			for (key of keysArr) {
				if (key == keysArr[keysArr.length-1]) {
					//this is the last key
					valValues += `${key} = ` + "$" + valDollarIncrement;
					valArray.push(values[key]);
					valDollarIncrement++;
					
				} else {
					//this is *not* the last key
					valValues += `${key} = ` + "$" + valDollarIncrement + ", ";
					valArray.push(values[key]);
					valDollarIncrement++;
				}
			}
		} else {
			valValues = `${keysArr[0]} = ` + "$" + valDollarIncrement;
			valArray.push(values[keysArr[0]]);
			valDollarIncrement++;
		}

		resolve({valArray, valCases, valValues})

	})
}

function processValues(object) {
	return new Promise((resolve, reject) => {
		try {
			var colsArr = Object.keys(object);
			var valArray = [];
			var valDollarIncrement = 1;
			var valDollars = "";
			var cols = "";
			
			if (colsArr.length > 1) {
				//iterate through all keys
				for (var key of colsArr) {
					if (key == colsArr[colsArr.length-1]) {
						//this is the last key, dont add a comma to <cols>
						cols += key;
						valDollars += ("$" + valDollarIncrement)
						valArray.push(object[key]);
					} else {
						//this is *not* the last key
						cols += `${key}, `;
						valDollars += ("$" + valDollarIncrement + ", ")
						valDollarIncrement++
						valArray.push(object[key]);
					}
				}
			} else {
				//only one key, no need to loop
				cols = colsArr[0];
				valDollars = "$1"
				valArray.push(object[colsArr[0]]);
			}

			resolve({cols, valArray, valDollars})
		} catch (err) {
			reject(err)
		}

	})
}

function processCols(cols, tableName) {
	return new Promise((resolve, reject) => {
		/* this processes column settings for creation of tables */
		/* sample <cols> format:
			[
				{name: "id", type: "bigint", allowEmpty: false, autoInc: true, primaryKey: true},
				{name: "title", type: "text"},
				{name: "zip", type: "int"},
			]
		*/
		try {
			var colDefaults = {
				allowEmpty: true,
				autoInc: false,
				primaryKey: false
			}
			var outQueryInsert = ""
			var outConstraints = ""

			let i = 0;
			for ( var col of cols ) {
				//iterate through each passed column def
				if (col["name"] && typeof(col["name"]) == "string") {
					//col name provided
					if (col["type"] && typeof(col["type"]) == "string") {
						//col type provided, process column
						var colOptions = { ...colDefaults, ...col }
						var queryString = `${col["name"]} ${col["type"]} `
						if (!col["allowEmpty"]) {
							//do not allow empty/allow null
							queryString += "NOT NULL "
						}
						if (col["autoInc"]) {
							//set auto increment
							queryString += "GENERATED ALWAYS AS IDENTITY "
						}
						if (col["primaryKey"]) {
							//add primary key constraint to end-attached constraints
							if (outConstraints == "") {
								//outConstraints is blank, do not add leading comma
								outConstraints += `CONSTRAINT ${tableName}_pkey PRIMARY KEY ( ${col["name"]} ) `
							} else {
								outConstraints += ` , CONSTRAINT ${tableName}_pkey PRIMARY KEY ( ${col["name"]} ) `
							}
							
						}
	
	
						//done processing column, add to outQueryInsert string
						if (outQueryInsert == "") {
							//outQueryInsert is blank, do not add leading comma
							outQueryInsert += queryString
						} else {
							outQueryInsert += ` , ${queryString}`
						}
	
					} else {
						log(`column type required, ignoring entry without column type (${i})...`)
					}
	
				} else {
					log(`column name required, ignoring entry without column name (${i})...`)
				}
				i++
			}
			
			if (outConstraints != "") {
				//outConstraints not blank, append to end of query part
				outQueryInsert += ` , ${outConstraints}`
				resolve({queryCols: outQueryInsert})
			} else {
				// no need to append any constraints
				resolve({queryCols: outQueryInsert})
			}
		} catch (err) {
			reject(err)
		}
	})
}

function processOptions(defaults, opts) {
	var options
	if (opts != undefined) { options = { ...defaults, ...opts } } else { options = defaults }
	return options
}

function processResponse(queryRes) {
	return {rows: queryRes.rows, rowCount: queryRes.rowCount, raw: queryRes}
}

function dbQuery(pool, query, valArray) {
    return new Promise((resolve, reject) => {
        pool.connect((err, client, release) => {
			try {
				if (err) {
					reject(err)
				}
				if (valArray) {
					//an array of values was passed, which needs to be sent to the database
					client.query(query, valArray, (err, res) => {
						if (err) {
							//err writing to db
							release()
							reject(err)
						} else {
							//item written to db
							release()
							resolve(res)
						}
						
					})
				} else {
					//no values were passed, this request has no selection 
					client.query(query, (err, res) => {
						if (err) {
							//err writing to db
							release()
							reject(err)
						} else {
							//item written to db
							release()
							resolve(res)
						}
						
					})
				}
				
			} catch (err) {
				reject(err)
			}
            
        })
    })
}

function log(text) {
    if (globals.consoleLogQueries) {
        console.log(text)
    }
}