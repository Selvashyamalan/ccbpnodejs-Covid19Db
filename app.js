const express = require('express')
const app = express()
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const jwt = require('jsonwebtoken')
const path = require('path')
const dbPath = (__dirname, 'covid19IndiaPortal.db')
const bcrypt = require('bcrypt')
app.use(express.json())

let db = null

const initiateServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('Server is running')
    })
  } catch (e) {
    console.log(`Error Occured`)
    process.exit(1)
  }
}

initiateServer()

const convertStateToObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDistrictObject = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

function authenticate(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const loginUser = `
    SELECT * FROM user
    WHERE username = '${username}';`
  const userDetails = await db.get(loginUser)
  if (userDetails === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatch = await bcrypt.compare(password, userDetails.password)
    if (isPasswordMatch === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenticate, async (request, response) => {
  const getStateList = `
  SELECT * FROM state;`
  const stateList = await db.all(getStateList)
  response.send(stateList.map(eachState => convertStateToObject(eachState)))
})

app.get('/states/:stateId/', authenticate, async (request, response) => {
  const {stateId} = request.params
  const getSingleState = `
  SELECT * FROM state
  WHERE state_id = '${stateId}';`
  const singleState = await db.get(getSingleState)
  response.send(convertStateToObject(singleState))
})

app.post('/districts/', authenticate, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const addDistrictList = `
  INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
  VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`
  await db.run(addDistrictList)
  response.send('District Successfully Added')
})

app.get('/districts/:districtId/', authenticate, async (request, response) => {
  const {districtId} = request.params
  const getSingleDistrict = `
  SELECT * FROM district
  WHERE district_id = '${districtId}';`
  const singleDistrict = await db.get(getSingleDistrict)
  response.send(convertDistrictObject(singleDistrict))
})

app.delete(
  '/districts/:districtId/',
  authenticate,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrict = `
  DELETE FROM district
  WHERE district_id = '${districtId}';`
    await db.run(deleteDistrict)
    response.send('District Removed')
  },
)

app.put('/districts/:districtId/', authenticate, async (request, response) => {
  const {districtId} = request.params
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const updateDistrict = `
  UPDATE district
  SET district_name ='${districtName}',
  state_id = ${stateId},
  cases = ${cases},
  cured = ${cured},
  active = ${active},
  deaths = ${deaths}
  WHERE district_id = '${districtId}';`
  await db.run(updateDistrict)
  response.send('District Details Updated')
})

app.get('/states/:stateId/stats/', authenticate, async (request, response) => {
  const {stateId} = request.params
  const statsCovid = `
  SELECT 
  SUM(cases),
  SUM(cured),
  SUM(active),
  SUM(deaths)
  FROM district
  WHERE state_id = '${stateId}';`
  const stats = await db.get(statsCovid)
  response.send({
    totalCases: stats['SUM(cases)'],
    totalCured: stats['SUM(cured)'],
    totalActive: stats['SUM(active)'],
    totalDeaths: stats['SUM(deaths)'],
  })
})

module.exports = app
