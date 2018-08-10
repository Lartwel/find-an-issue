'use strict'

const fs = require('fs')
const express = require('express')
const cron = require('cron')
const shell = require('shelljs')

const options = require('./options')
const repos = options.repos
const githubOptions = options.githubOptions

const utils = require('./utils')
const tableDeletion = utils.tableDeletion
const createTable = utils.createTable
const waitForCreation = utils.waitForCreation
const waitForDeletion = utils.waitForDeletion
const syncTimeout = utils.syncTimeout
const putIntoDB = utils.putIntoDB
const attemptRequest = utils.attemptRequest
const scan = utils.scan

const app = express()

const tableCreation = async () => {
  await tableDeletion()
  await waitForDeletion()
  await createTable()
  await waitForCreation()

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i].repo
    const baseUrl = 'https://api.github.com/repos/'
    githubOptions.url = baseUrl + repo + '/issues'
    console.log('Repository: ', i, 'out of ', repos.length, ' repositories.')

    const issues = await attemptRequest(repo)
    if (!Array.isArray(issues)) {
      console.log(issues)
      if (issues.message !== 'Not Found') {
        i--
        console.log('rate limit reached, 30 second timeout')
        await syncTimeout()
      }
    } else {
      const putResult = await putIntoDB(issues, repos[i])
      if (putResult === 'throughput error') {
        i--
        await syncTimeout()
      }
    }
  }
  return true
}

// end of deletion and recreation of table while inputting new data

const scanFunc = async () => {
  const data = await scan()

  fs.writeFile('../src/data.json', JSON.stringify(data, undefined, 2), function(
    err
  ) {
    if (err) {
      console.log('Error writing file', err)
    }
    console.log('File written.')
  })
  return true
}

// end of creation of file that will be used in the front end from initial data scraping

// var job = new cron.CronJob({
//   cronTime: '00 30 11 * * 0-6',
//   onTick: async function() {
//     console.log('Cron Job has begun.')
//   },
//   start: true,
//   timeZone: 'America/Los_Angeles'
// })

// job.start()

const doStuff = async () => {
  await tableCreation()
  await scanFunc()
  setTimeout(() => {
    shell.exec('./git.sh')
  }, 2000)
  console.log('Finished with all the steps!')
}

doStuff()
app.listen('3128')
