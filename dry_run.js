const aws_helper = require("./index");


let aws_object = new aws_helper({ log_level: "debug", lambda_aws_credentials_profile: "default" });
let item = {
  user_id: { S: 'Richard Roe' },
  device_id: { S: "Richard2" }
}



let a = aws_object.get_data(item);
console.log("This is a : ", a);


// let query = { query: `{getAllStatus{ statusName } }` };
// let headers = {
//   "Content-Type": "application/json"
// }

// aws_object.execute_lambda("rds_connection_test", { path: "/api", body: query, headers: headers });
