"use strict";

const http = require("http");
const AWS = require("aws-sdk");


/////////////////////////////////////////////////////////////////////general helper functions////////////////////////////////////////////////////////////////

function get_aws_object(region = 'us-east-2', profile = 'archive', new_object_required = false) {
    let aws_object = this.aws_object;
    if (!this.aws_object || new_object_required) {
        this.helper_logger.info("Getting new aws_object");
        try {
            var credentials = new AWS.SharedIniFileCredentials({ profile: profile });
            AWS.config.credentials = credentials;
            this.helper_logger.info('Successfully set credentials : ');
        } catch{
            this.helper_logger.warning('Error while getting credentials. Maybe in lambda. Going forward without them.')
        }
        AWS.config.update({ region: region });
        aws_object = AWS;
    } else {
        log.info("AWS object already exists and new_object_required is set false. So, returning existing aws_object.");
    }
    return aws_object;
}


function get_db_object(api_version) {
    if(api_version){
        var ddb = new AWS.DynamoDB({ apiVersion: api_version });
    }else{
        var ddb = new AWS.DynamoDB();
    } 
    return ddb;
}


function create_response(data, status_code, message = "") {
    message = `${http.STATUS_CODES[status_code]}. ${message}`;
    let response = {
        data: data,
        status: status_code,
        message: message.trim()
    }
    this.helper_logger.debug("Response created : ", response);
    return response;
}


function get_error_message(err) {
    let message;
    if (err.code) {
        if (err.message) {
            message = `${err.code} : ${err.message}`;
        } else {
            message = `${err.code}`;
        }
    } else {
        if (typeof (err) != "string") {
            message = JSON.stringify(err);
        } else {
            message = err;
        }
    }
    return message;
}



function get_error_response(err) {
    let message = this.get_error_message(err);
    let status_code = 500;
    if (err.statusCode) {
        status_code = err.statusCode;
    }
    else if (err.code) {
        if (['MissingRequiredParameter', 'MultipleValidationErrors', 'ValidationException'].includes(err.code)) { status_code = 400; }
    }
    return this.create_response(null, status_code, message);
}


function get_err_or_data_callback(err, data) {
    if (err) {
        let response = this.get_error_response(err);
        this.helper_logger.error("There was an error : ", response.message);
        return response;
    } else {
        this.helper_logger.info("Executed successfully.");
        return this.create_response(data, 200)
    }
}


///////////////////////////////////////////////////////////////dynamodb helper functions///////////////////////////////////////////////////////////////////////////


function generate_write_item(data) {
    let write_item = {
        TableName: this.table_name,
        Item: data
    }
    return write_item;
}


async function write_data(data) {
    if (this.write_data_validation) {
        this.helper_logger.info("Running data validation.");
        let response = await this.write_data_validation(data);
        if (response.status != 200) {
            this.helper_logger.error("Validation failed. validation_function_response.status != 200. validation_function_response.message : ", response.message);
            this.get_err_or_data_callback(response);
            return;
        }
    }
    let write_item = this.generate_write_item(data);
    this.helper_logger.debug("Writing item to db : ", write_item);
    let response = this.db_con.putItem(write_item, this.get_err_or_data_callback.bind(this));
    return response;
}



function generate_get_item(data, projection_expression) {
    let get_item = {
        TableName: this.table_name,
        Key: data,
    }
    if (projection_expression) { get_item.ProjectionExpression = projection_expression }
    return get_item;
}



async function get_data(data, projection_expression) {
    if (this.get_data_validation) {
        this.helper_logger.info("Running data validation.");
        let response = await this.get_data_validation(data);
        if (response.status != 200) {
            this.helper_logger.error("Validation failed. validation_function_response.status != 200. validation_function_response.message : ", response.message);
            this.get_err_or_data_callback(response);
            return;
        }
    }
    let get_item = this.generate_get_item(data, projection_expression);
    this.helper_logger.debug("Getting item from db : ", get_item);
    let response = this.db_con.getItem(get_item, this.get_err_or_data_callback.bind(this));
    return response;
}



function generate_delete_item(data) {
    let delete_item = {
        TableName: this.table_name,
        Key: data,
    }
    return delete_item;
}



async function delete_data(data) {
    if (this.delete_data_validation) {
        this.helper_logger.info("Running data validation.");
        let response = await this.delete_data_validation(data);
        if (response.status != 200) {
            this.helper_logger.error("Validation failed. validation_function_response.status != 200. validation_function_response.message : ", response.message);
            this.get_err_or_data_callback(response);
            return;
        }
    }
    let delete_item = this.generate_delete_item(data);
    this.helper_logger.debug("Deleting item from db : ", delete_item);
    let response = this.db_con.deleteItem(delete_item, this.get_err_or_data_callback.bind(this));
    return response;
}



////////////////////////////////////////////////////////////////////lambda helper functions//////////////////////////////////////////////////////////////////////////



function get_lambda_object(api_version) {
    let aws_object = AWS;
    if(this.lambda_region && this.region != this.lambda_region){
        let profile;
        if(this.lambda_aws_credentials_profile){
            profile = this.lambda_aws_credentials_profile;
        }else{
            profile = this.aws_credentials_profile;
        }
        aws_object = this.get_aws_object(this.lambda_region, profile, true);
    }
    if(api_version){
        var lambda = new aws_object.Lambda({ apiVersion: api_version });
    }else{
        var lambda = new aws_object.Lambda();
    } 
    return lambda;
}



function generate_lambda_param(lambda_name, payload){
    let lambda_param = {
        FunctionName: lambda_name, // the lambda function we are going to invoke
        InvocationType: this.lambda_invocation_type,
        LogType: this.lambda_log_type,
        Payload: JSON.stringify(payload)
    }
    return lambda_param;
}



function execute_lambda(lambda_name, payload){
    let lambda_param = this.generate_lambda_param(lambda_name, payload);
    this.helper_logger.debug("Invoking lambda with params : ", lambda_param);
    let response = this.lambda.invoke(lambda_param, this.get_err_or_data_callback.bind(this));
    return response;
}


module.exports = {
    get_aws_object, get_db_object, create_response, get_error_message, get_err_or_data_callback, get_error_response, //general helpers
    write_data, generate_write_item, get_data, generate_get_item, delete_data, generate_delete_item,   //db helpers
    get_lambda_object, execute_lambda, generate_lambda_param     //lambda helpers
};