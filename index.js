"use strict";

var helper = require("./helpers");
const Logger = require("./logging").Logger;
const autoBind = require("auto-bind");



//can be implimented within validation functions. 
var get_data_required_params = ["user_id", "device_id"];
var write_data_required_params = ["user_id", "device_id", "jwt", "permission", "last_visited", "request_log", "user_type", "expiry_interval", "login_time"];
var delete_data_required_params = ["user_id", "device_id"];




/**
 * This module is to perform read, write and delete operations on dynamodb, and execute other lambda functions.
 * Requirements : 
 * - If being run locally, there should be a credentials file in ~/.aws/ directory. Sample credentials :
 * ***********************
 * [default]
 * aws_access_key_id=sample_access_key1
 * aws_secret_access_key=sample_secret_key1
 * 
 * [archive]
 * aws_access_key_id=sample_access_key2
 * aws_secret_access_key=sample_secret_key2
 * ***********************
 * 
 * Here, 'default' and 'archive' are credentials profile, which can be passed to this module as setup.
 * Seperate profiles can be used for lambda and dynamodb, along with seperate region and api_version.
 * These iam uses should have permissions to execute lambda. This can be given by adding 'AWSLambdaExecute' and 'AWSLambdaBasicExecutionRole' policies.
 * 
 * - If being run on lambda, the lambda should have a role with 'AWSLambdaExecute' and 'AWSLambdaBasicExecutionRole' policies attached.
 * 
 * Initialising aws_helper : 
 * - create a setup object : {
 *  table_name : "example_table_name",
 *  region : "region",
 *  ...
 * } 
 * - initialise aws_helper with the setup object : 
 *  aws_object = new aws_helper(setup);
 * 
 * How to use : 
 * 
 * - Using Dynamodb operations - [write_data], [read_data], [delete_data]:
 * the data for these operations need to be provided in a specific format : 
 * data = {
 *  user_id: { S: 'Richard Roe' },
 *  device_id: { S: "Richard" }
 * }
 * Here, user_id and device_id are the keys or column ids in the dynamo_db table. 
 * 'S' represents string data type. Similarly, you can pass in number 'N', Bool 'B' (0 or 1), etc. 
 * check https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBMapper.DataTypes.html for other data types supported.
 * These functions will call get_err_or_data_callback upon task completion. There is a default [get_err_or_data_callback] function
 * present, which can be overridden at the time of setup and at runtime as well. The function will be bound with 'this' of the 
 * aws_object at the time of execution.
 * 
 * Required columns can be added on the fly to dynamodb. However, keys defined in the table are required to be sent for operations.
 * Since, dynamodb table structure is not concrete, it is easy to end up with data with discrepancies or incomplete data. Therefore, 
 * validating data before performing any operation is recommended.
 * 
 * Three validation function can be added to aws_helper - write_data_validation, get_data_validation, delete_data_validation.
 * Each validation function will be called before write_data, get_data and delete_data execution respectively.
 * These validation functions should return an object with two properties - status (200 if success, or otherwise), and message(useful in error
 * scenarios).
 * 
 * - Calling [write_data]:
 *  aws_object.write_data(data)
 * 
 * Will return empty object upon successful execution to callback function.
 * 
 * 
 * 
 * - Calling [read_data]:
 *  aws_object.write_data(data)
 * ProjectionExpression can also be passed to customise the read operation. You can read more about them at : 
 *  https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ProjectionExpressions.html
 * 
 * Will return query data object upon successful execution to callback function.
 * 
 * 
 * 
 * - Calling [delete_data]:
 *  aws_object.delete_data(data)
 * 
 * Will return empty object upon successful execution to callback function.
 * 
 * /////////////////////////////////////////////For [Lambda] Execution//////////////////////////////////////////////////////////
 * 
 * Lambda region and profile(if running locally) can be set seperately. 
 * 
 * lambda can be executed using [aws_object.execute_lambda] 
 * [execute_lambda] function takes two parameters - (lambda_function_name, payload)
 * 
 * payload will be what the other lambda function will get as 'event' object. Therefore, everything that can be done through
 * other methods of trigerring lambda, can be done with this method. The data has to be mocked accordingly.
 * 
 * The paths can be given by 'path' parameter : 
 * eg : 
 * payload = {
 *  path : "/api"
 * }
 * And the actual data to be passed can be given by 'body' parameter : 
 * eg : 
 * payload = {
 *  path : "/api",
 *  body : "{some : object}"
 * }
 * 
 * Similarly, Headers can also be mocked : 
 * headers = {
 *  Content-Type : "application/json"
 * }
 * 
 * payload = {
 *  path : "/users/api",
 *  body : "{some : object}",
 *  headers : headers
 * }
 * 
 * 
 * For using graphql and sending graphql queries, headers have to be sent with Content-Type : "application/json".
 * Also, the body should have a 'query' parameter in it with the value being the query itself. 
 * 
 * Eg for graphql query : 
 * headers = {
 *  Content-Type : "application/json"
 * }
 * query = { query: `
 *      {
 *        getAllStatus{
 *         statusName 
 *         } 
 *      }` 
 *   };
 * payload = {
 *  path : "/api",
 *  body : query,
 *  headers : headers
 * }
 * aws_object.execute_lambda(lambda_function_name, payload)
 */


let default_setup = {
  table_name: "user_middle_cache",
  region: "us-east-2",
  apiVersion: null,
  log_level: "DEBUG",
  aws_credentials_profile: "archive",
  get_data_required_params: get_data_required_params,
  write_data_required_params: write_data_required_params,
  delete_data_required_params: delete_data_required_params,
  write_data_validation: null,
  get_data_validation: null,
  delete_data_validation: null,
  lambda_aws_credentials_profile: null,
  lambda_apiVersion: null,
  lambda_region: "us-east-1",
  lambda_log_type: "Tail",
  lambda_invocation_type: "RequestResponse",
  get_err_or_data_callback: helper.get_err_or_data_callback
};


class aws_helper {
  constructor(setup) {
    //adding setup parameters to 'this' if present
    Object.keys(default_setup).forEach(element => {
      this[element] = setup[element] || default_setup[element];
    });


    //loger setup
    this.helper_logger = new Logger("helpers", this.log_level);
    this.index_logger = new Logger("index", this.log_level);


    //adding helper functions
    this.index_logger.debug("Adding helpers to aws_helper.")
    Object.keys(helper).forEach(element => {
      this.index_logger.debug(`Added helper - ${element}`);
      this[element] = helper[element];
    });


    //db connector setup
    this.index_logger.debug("Setting up connection for db_con.");
    this.aws_object = this.get_aws_object(setup.region, setup.aws_credentials_profile);
    this.db_con = this.get_db_object(this.apiVersion);


    //lambda object setup
    this.index_logger.debug("Setting up lambda object.");
    this.lambda = this.get_lambda_object(this.lambda_apiVersion)


    //binding 'this' to methods
    autoBind(this);
  }
}

module.exports = aws_helper;