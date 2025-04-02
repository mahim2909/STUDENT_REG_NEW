// import config from 'config';
// import mysql from 'mysql';
var mysql = require('mysql');
var config = require('config');
// var mysql = require('mysql');

var exec = function (query, data)  {
    return new Promise((resolve, reject) => {
        if (!query) {
            return reject("Query not found");
        }
        const connection = mysql.createConnection({
            host: config.get('db.host'),
            user: config.get('db.user'),
            password: config.get('db.password'),
            database: config.get('db.database'),
            multipleStatements: true
        });

        connection.connect(err => {
            if (err) {
                return reject(err);
            }

            connection.query(query, data, (err, results) => {
                connection.end();  // Properly close connection
                if (err) {
                    return reject(err);
                }
                resolve(results);
            });
        });
    })
}

module.exports.exec = exec;