//--- Import the Google Cloud client library
const {
  BigQuery
} = require('@google-cloud/bigquery');
const {
  google
} = require('googleapis');
const fs = require('fs');

//-- Set ENV Variable
const googlejsonkeypathgroupsadmin = "/Users/stonian/Documents/google-keys/groupautomation-ccd2a10d7e95.json"
const groupkey = require(googlejsonkeypathgroupsadmin)
const googlejsonkeypath = "/Users/stonian/Documents/google-keys/groupautomation-ccd2a10d7e95.json" //"/path/to/keyfile.json"
process.env.GOOGLE_APPLICATION_CREDENTIALS = googlejsonkeypath

function initializeAdmin(version = "directory_v1") {
  const client_email = groupkey.client_email;
  // add some necessary escaping so to avoid errors when parsing the private key.
  const private_key = groupkey.private_key.replace(/\\n/g, "\n");
  // impersonate an account with access to ADMIN API by addding service account client ID here: https://admin.google.com/AdminHome?chromeless=1#OGX:ManageOauthClients
  const emailToImpersonate = "curator@gp-test.org";
  const jwtClient = new google.auth.JWT(
    client_email,
    null,
    private_key,
    ['https://www.googleapis.com/auth/admin.directory.group',
      'https://www.googleapis.com/auth/admin.directory.group.member'
    ],
    emailToImpersonate
  );
  return google.admin({
    version: version,
    auth: jwtClient
  });
}
let admin = initializeAdmin()
// console.log(admin)
// addGroup('gpi-interns').then(function(res){
//   console.log("res : " + res)
// }).catch(function(err){
//   console.log("errs : " + err)
// });

async function addGroup(name) {
  //-- name should be in the format [SEC_NRO_SYMBOL/CONT_NRO_SYMBOL]-[IAM_EMPLOYEE_TYPE]-curated-group e.g. gpi-interns-automated-group
  const res = await admin.groups.insert({
    requestBody: {
      email: name
    },
  });

  console.log(res.data);
}
async function deleteGroup(name) {
  //-- name should be in the format [SEC_NRO_SYMBOL/CONT_NRO_SYMBOL]-[IAM_EMPLOYEE_TYPE]-curated-group e.g. gpi-interns-automated-group
  const res = await admin.groups.delete({
    groupKey: name
  });

  console.log(res.data);
}


const projectID = "greenpeace-testing"
const datasetID = "IAM_Report_Testing"
const tableID = "OPENIAM_BASIC_DATA"
const queryAdditionals = " WHERE IAM_STATUS != 'DELETED' AND IAM_SECONDARY_STATUS != 'DISABLED' AND IAM_STATUS != 'PENDING_INITIAL_LOGIN'" // " WHERE GOOGLE_LOGIN='amelekou@gp-test.org' LIMIT 100" to get a user with two nros set and to limit number of returned results
let nros = []
let employeetypes = []
let groups = {}

let contcount = 0
let seccount = 0
let emptyemployeetypecount = 0

//nros.indexOf(row.CONTR_NRO_SYMBOL) === -1 ? nros.push(row.CONTR_NRO_SYMBOL);

async function listMembersOfGroup(group,npt) {
  let retarr = []
  let res = await admin.members.list({
    groupKey: group,
    pageToken: null
  });

  if (res.data.members !== undefined) {
    for (var i = 0; i < res.data.members.length; i++) {
      retarr.push(res.data.members[i].email)
    }
    if(res.data.nextPageToken !== undefined) {
      listMembersOfGroup(group,res.data.nextPageToken)
    }
  }
  return retarr
}
// listMembersOfGroup("int-functionals-automated-group@gp-test.org").then(function(res) {
//   console.log("resss: " + res)
// }).catch(function(err) {
//   console.log("errs : " + err)
// });

async function addToGroup(user, group) {
  let res = await admin.members.insert({
    groupKey: group,
    requestBody: {
      email: user
    }
  });
  return res
}
async function delFromGroup(user, group) {
  let res = await admin.members.delete({
    groupKey: group,
    memberKey: user
  });
  return res
}

async function processGroups(type) {
  let googlejsonkeypathbq = "/Users/stonian/Documents/google-keys/greenpeace-testing-c514737adcdb.json" //"/path/to/keyfile.json"
  process.env.GOOGLE_APPLICATION_CREDENTIALS = googlejsonkeypathbq
  // Create a client
  const bigqueryClient = new BigQuery();
  // Construct query
  const query = "SELECT GOOGLE_LOGIN,IAM_EMPLOYEE_TYPE,CONTR_NRO_SYMBOL,CONT_NRO_OFFICE_SYMBOL,SEC_NRO_OFFICE_SYMBOL,SEC_NRO_SYMBOL FROM `" + projectID + "." + datasetID + "." + tableID + "`" + queryAdditionals;
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
    // console.log(rows[i])
    //--- Clean up employeetypes that have spaces
    if (rows[i].IAM_EMPLOYEE_TYPE == "Greenpeace User Account") {
      rows[i].IAM_EMPLOYEE_TYPE = "gp_user"
    } else if (rows[i].IAM_EMPLOYEE_TYPE == "Greenpeace Functional Account") {
      rows[i].IAM_EMPLOYEE_TYPE = "functional"
    } else if (rows[i].IAM_EMPLOYEE_TYPE == "External Contractor") {
      rows[i].IAM_EMPLOYEE_TYPE = "contractor"
    } else if (rows[i].IAM_EMPLOYEE_TYPE == "DDII User Account") {
      rows[i].IAM_EMPLOYEE_TYPE = "ddii_user"
    } else if (rows[i].IAM_EMPLOYEE_TYPE == "SYSTEM ACCOUNT") {
      rows[i].IAM_EMPLOYEE_TYPE = "system_account"
    } else if (rows[i].IAM_EMPLOYEE_TYPE == "Freelancer") {
      rows[i].IAM_EMPLOYEE_TYPE = "freelancer"
    } else if (rows[i].IAM_EMPLOYEE_TYPE == "Intern") {
      rows[i].IAM_EMPLOYEE_TYPE = "intern"
    }  else if (rows[i].IAM_EMPLOYEE_TYPE == "Vendor") {
      rows[i].IAM_EMPLOYEE_TYPE = "vendors"
    }  else if (rows[i].IAM_EMPLOYEE_TYPE == null) {
      emptyemployeetypecount++
    }

    let officesymbol
    let secofficesymbol

    if (rows[i].CONT_NRO_OFFICE_SYMBOL === null){
      officesymbol=""
    } else {
      officesymbol="-"+rows[i].CONT_NRO_OFFICE_SYMBOL
    }
    if (rows[i].SEC_NRO_OFFICE_SYMBOL === null){
      secofficesymbol=""
    } else {
      secofficesymbol="-"+rows[i].SEC_NRO_OFFICE_SYMBOL
    }

    //--- Check if Contracted NRO symbol exists in nros array
    if (nros.indexOf(rows[i].CONTR_NRO_SYMBOL+officesymbol) === -1 && rows[i].GOOGLE_LOGIN != null) {
      //--- Add to nros array and create a child object in groups with the same name
      nros.push(rows[i].CONTR_NRO_SYMBOL+officesymbol)
      console.log("constructing:"+rows[i].CONTR_NRO_SYMBOL+officesymbol)
      groups[rows[i].CONTR_NRO_SYMBOL+officesymbol] = {}
    }

    //--- Check if Secondary NRO symbol exists in nros array SEC_NRO_OFFICE_SYMBOL
    if (nros.indexOf(rows[i].SEC_NRO_SYMBOL+secofficesymbol) === -1 && rows[i].GOOGLE_LOGIN != null) {
      //--- Add to nros array and create a child object in groups with the same name
      nros.push(rows[i].SEC_NRO_SYMBOL+secofficesymbol)
      console.log("constructing sec:"+rows[i].SEC_NRO_SYMBOL+secofficesymbol)
      groups[rows[i].SEC_NRO_SYMBOL+secofficesymbol] = {}
    }
    //--- Check if Employee Type exists in employeetypes array
    if (employeetypes.indexOf(rows[i].IAM_EMPLOYEE_TYPE) === -1 && rows[i].GOOGLE_LOGIN != null) {
      //--- Add to employeetypes array
      employeetypes.push(rows[i].IAM_EMPLOYEE_TYPE)
    }

    //--- Create array object from NRO and Employee Type based on Contracted Office
    if (rows[i].CONTR_NRO_SYMBOL+officesymbol != null && rows[i].IAM_EMPLOYEE_TYPE != null && rows[i].GOOGLE_LOGIN != null) {
      groups[rows[i].CONTR_NRO_SYMBOL+officesymbol][rows[i].IAM_EMPLOYEE_TYPE] = []
    }
    //---Create array object from NRO and Employee Type based on Secondary Office
    if (rows[i].SEC_NRO_SYMBOL+secofficesymbol != null && rows[i].IAM_EMPLOYEE_TYPE != null && rows[i].GOOGLE_LOGIN != null) {
      groups[rows[i].SEC_NRO_SYMBOL+secofficesymbol][rows[i].IAM_EMPLOYEE_TYPE] = []
    }
  }

  for (var i = 0; i < rows.length; i++) {
    if (rows[i].CONT_NRO_OFFICE_SYMBOL === null){
      officesymbol=""
    } else {
      officesymbol="-"+rows[i].CONT_NRO_OFFICE_SYMBOL
    }
    if (rows[i].SEC_NRO_OFFICE_SYMBOL === null){
      secofficesymbol=""
    } else {
      secofficesymbol="-"+rows[i].SEC_NRO_OFFICE_SYMBOL
    }

    if (rows[i].CONTR_NRO_SYMBOL+officesymbol != null && rows[i].IAM_EMPLOYEE_TYPE != null && rows[i].GOOGLE_LOGIN != null) {
      //--- Add user to the subgroup of Contracted NRO and Employee Type
      groups[rows[i].CONTR_NRO_SYMBOL+officesymbol][rows[i].IAM_EMPLOYEE_TYPE].push(rows[i].GOOGLE_LOGIN)
      contcount++
      //--- Add user to the subgroup of Secondary NRO and Employee Type if Secondary exists
      if (rows[i].SEC_NRO_SYMBOL+secofficesymbol != null) {
        groups[rows[i].SEC_NRO_SYMBOL+secofficesymbol][rows[i].IAM_EMPLOYEE_TYPE].push(rows[i].GOOGLE_LOGIN)
        seccount++
      }
    }
  }
  console.log('rows : ' + rows.length)
  console.log("contcount : " + contcount)
  console.log("seccount : " + seccount)
  console.log("emptyemployeetypecount : " + emptyemployeetypecount)
  console.log("nros : " + nros.length + " : " + nros)
  console.log("employeetypes : " + employeetypes.length + " : " + employeetypes)
  console.log('=============================');
  console.log('saving to groups.json')
  fs.writeFile('groups.json', JSON.stringify(groups, null, 4), function(res) {
    console.log(res)
  })
  // to add users to groups
  // to add or delete groups
  if (type == "add") {
    for (nro in groups) {
      if (nro != "null") {
        console.log("-- " + nro)
        for (employeetype in groups[nro]) {
          let address = nro.toLowerCase() + "-" + employeetype + "s-automated-group@gp-test.org"
          console.log("adding group : " + address)
          //replace addGroup function to with removeGroup to remove automated groups
          await addGroup(address).then(function(ret) {
            console.log("successfully processed : " + address)
          }).catch(function(err) {
            console.log("error:" + err + " for " + address)
          })
        }
      }
    }
  } else if (type == "delete") {
    for (nro in groups) {
      if (nro != "null") {
        console.log("-- " + nro)
        for (employeetype in groups[nro]) {
          let address = nro.toLowerCase() + "-" + employeetype + "s-automated-group@gp-test.org"
          console.log("deleting group : " + address)
          //replace addGroup function to with removeGroup to remove automated groups
          await deleteGroup(address).then(function(ret) {
            console.log("successfully processed : " + address)
          }).catch(function(err) {
            console.log("error:" + err + " for " + address)
          })
        }
      }
    }
  } else if (type == "curateusers") {
    for (nro in groups) {
      if (nro != "null") {
        console.log("-- " + nro)
        for (employeetype in groups[nro]) {
          let address = nro.toLowerCase() + "-" + employeetype + "s-automated-group@gp-test.org"
          console.log("adding users to : " + address + " with current size : "+ groups[nro][employeetype].length)
          //replace addGroup function to with removeGroup to remove automated groups
          await listMembersOfGroup(address).then(async function(ret) {
            let currentgroupmembers = ret
            let toupdategroupmembers = groups[nro][employeetype]
            console.log("starting currentgroupmembers size: " + currentgroupmembers.length)
            console.log("starting toupdategroupmembers size: " + toupdategroupmembers.length)
            //console.log("users : " + currentgroupmembers +"\ntoadd "+toupdategroupmembers)
            for (var i = 0; i < currentgroupmembers.length; i++) {
              console.log("cur nur : " + i)
              let found = false
              for (var j = toupdategroupmembers.length-1; j >= 0; j--) {
                if(currentgroupmembers[i]==toupdategroupmembers[j]){
                  console.log(j+"]"+currentgroupmembers[i] + " found")
                  found=true
                  toupdategroupmembers.splice(j, 1);
                  j=-1
                }
              }
              if(!found){
                console.log("removing "+currentgroupmembers[i]+" from "+ address)
                await delFromGroup(currentgroupmembers[i],address).then(function(ret){
                  console.log(ret)
                }).catch(function(err){
                  console.log(err)
                })
              }
            }
            console.log("new updatelist size: " + toupdategroupmembers.length)
            for (var i = 0; i < toupdategroupmembers.length; i++) {
              await addToGroup(toupdategroupmembers[i],address).then(function(ret){
                console.log(ret)
              }).catch(function(err){
                console.log(err)
              })
            }
          }).catch(function(err) {
            console.log("errord:" + err + " for " + address)
          })
        }
      }
    }
  }

}
processGroups("curateusers")
