//--- Import the Google Cloud client library
const {BigQuery} = require('@google-cloud/bigquery');
const fs = require('fs');

const projectID="greenpeace-testing"
const datasetID="IAM_Report_Testing"
const tableID="OPENIAM_BASIC_DATA"
const queryAdditionals="" // " WHERE GOOGLE_LOGIN='amelekou@gp-test.org' LIMIT 100" to get a user with two nros set and to limit number of returned results
let nros = []
let employeetypes = []
let groups = {}

let contcount = 0
let seccount = 0

//nros.indexOf(row.CONTR_NRO_SYMBOL) === -1 ? nros.push(row.CONTR_NRO_SYMBOL);

async function query() {
  // Create a client
  const bigqueryClient = new BigQuery();
  // Construct query
  const query = "SELECT GOOGLE_LOGIN,IAM_EMPLOYEE_TYPE,CONTR_NRO_SYMBOL,CONT_NRO_OFFICE_SYMBOL,SEC_NRO_OFFICE_SYMBOL,SEC_NRO_SYMBOL FROM `"+projectID+"."+datasetID+"."+tableID+"`"+queryAdditionals;
  const options = {
    query: query,
    //--- Location must match that of the dataset(s) referenced in the query.
    location: 'EU',
  };

  //--- Run the query as a job
  const [job] = await bigqueryClient.createQueryJob(options)

  console.log(`Job ${job.id} started.`);

  //--- Wait for the query to finish
  const [rows] = await job.getQueryResults();

  //--- Construct nros and their subgroups
  for (var i = 0; i < rows.length; i++) {
    console.log(rows[i])
    //--- Clean up employeetypes that have spaces
    if(rows[i].IAM_EMPLOYEE_TYPE == "Greenpeace User Account"){
      rows[i].IAM_EMPLOYEE_TYPE = "gp_user"
    } else if (rows[i].IAM_EMPLOYEE_TYPE == "Greenpeace Functional Account") {
      rows[i].IAM_EMPLOYEE_TYPE = "functional"
    } else if (rows[i].IAM_EMPLOYEE_TYPE == "External Contractor") {
      rows[i].IAM_EMPLOYEE_TYPE = "contractor"
    } else if (rows[i].IAM_EMPLOYEE_TYPE == "DDII User Account") {
      rows[i].IAM_EMPLOYEE_TYPE = "ddii_user"
    } else if (rows[i].IAM_EMPLOYEE_TYPE == "SYSTEM ACCOUNT") {
      rows[i].IAM_EMPLOYEE_TYPE = "system_account"
    }

    //--- Check if Contracted NRO symbol exists in nros array
    if(nros.indexOf(rows[i].CONTR_NRO_SYMBOL) === -1 && rows[i].GOOGLE_LOGIN != null){
      //--- Add to nros array and create a child object in groups with the same name
      nros.push(rows[i].CONTR_NRO_SYMBOL)
      groups[rows[i].CONTR_NRO_SYMBOL]={}
    }

    //--- Check if Secondary NRO symbol exists in nros array
    if(nros.indexOf(rows[i].SEC_NRO_SYMBOL) === -1 && rows[i].GOOGLE_LOGIN != null){
      //--- Add to nros array and create a child object in groups with the same name
      nros.push(rows[i].SEC_NRO_SYMBOL)
      groups[rows[i].SEC_NRO_SYMBOL]={}
    }
    //--- Check if Employee Type exists in employeetypes array
    if(employeetypes.indexOf(rows[i].IAM_EMPLOYEE_TYPE) === -1 && rows[i].GOOGLE_LOGIN != null){
      //--- Add to employeetypes array
      employeetypes.push(rows[i].IAM_EMPLOYEE_TYPE)
    }

    //--- Create array object from NRO and Employee Type based on Contracted Office
    if(rows[i].CONTR_NRO_SYMBOL != null && rows[i].IAM_EMPLOYEE_TYPE != null && rows[i].GOOGLE_LOGIN != null){
      groups[rows[i].CONTR_NRO_SYMBOL][rows[i].IAM_EMPLOYEE_TYPE]=[]
    }
    //---Create array object from NRO and Employee Type based on Secondary Office
    if(rows[i].SEC_NRO_SYMBOL != null && rows[i].IAM_EMPLOYEE_TYPE != null && rows[i].GOOGLE_LOGIN != null){
      groups[rows[i].SEC_NRO_SYMBOL][rows[i].IAM_EMPLOYEE_TYPE]=[]
    }
  }

  for (var i = 0; i < rows.length; i++) {
    if(rows[i].CONTR_NRO_SYMBOL != null && rows[i].IAM_EMPLOYEE_TYPE != null && rows[i].GOOGLE_LOGIN != null){
      //--- Add user to the subgroup of Contracted NRO and Employee Type
      groups[rows[i].CONTR_NRO_SYMBOL][rows[i].IAM_EMPLOYEE_TYPE].push(rows[i].GOOGLE_LOGIN)
      contcount++
      //--- Add user to the subgroup of Secondary NRO and Employee Type if Secondary exists
      if(rows[i].SEC_NRO_SYMBOL != null){
        groups[rows[i].SEC_NRO_SYMBOL][rows[i].IAM_EMPLOYEE_TYPE].push(rows[i].GOOGLE_LOGIN)
        seccount++
      }
    }
  }
  console.log('rows : '+ rows.length);
  console.log("nros : "+nros.length + " : " + nros)
  console.log("contcount : "+contcount)
  console.log("seccount : "+seccount)
  console.log("employeetypes : " + employeetypes.length+ " : " +employeetypes)
  console.log('=============================');
  console.log('saving to groups.json')
  fs.writeFile('groups.json', JSON.stringify(groups, null, 4), function(res){
    console.log(res)
  })
}
query();
