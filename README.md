## global-ops-iam-employee-type-to-nro-subgroups
This one-file node script should poll the current list of greenpeacers and read in their status and employee type. We will then match the current pulled data to the live google groups based on their NRO and employee type. This will allow automated groups from IAM data to be used by NRO admins in addressing / assigning rights.

### Use:
``` shell
$ git clone https://github.com/greenpeace/global-ops-iam-employee-type-to-nro-subgroups
$ cd global-ops-iam-employee-type-to-nro-subgroups
$ vi config.json #change json key paths here
$ npm install
$ node index.js
```
