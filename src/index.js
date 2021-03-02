const NodeRSA = require('node-rsa')
const path = require('path')
const fs = require('fs')
const got = require('got')
const { CookieJar } = require('tough-cookie')
const sendNotify = require('./sendNotify')

const resolve = function (...args) {
  return path.resolve(__dirname, ...args)
}

let count = 0
const times = 20

const cookieJar = new CookieJar()

const customGot = got.extend({
  cookieJar,
})

const publicKey = fs.readFileSync(resolve('public.pem'), 'utf8')

const key = new NodeRSA(publicKey, 'pkcs8-public', {
  encryptionScheme: 'pkcs1',
})

const api = {
  login: 'https://changjiang.yuketang.cn/pc/login/verify_pwd_login/',
  getOnLessonData: 'https://changjiang.yuketang.cn/api/v3/classroom/on-lesson',
  attendLesson: 'https://changjiang.yuketang.cn/api/v3/lesson/checkin',
}

const login = async (username, password) => {
  const body = await customGot(api.login, {
    method: 'POST',
    json: {
      type: 'PP',
      name: username,
      pwd: key.encrypt(password, 'base64'),
    },
  }).json()
  if (!body.success) throw new Error('login failed')
}

const getOnLessonId = async () => {
  const {
    data: { onLessonClassrooms },
  } = await customGot(api.getOnLessonData).json()
  return onLessonClassrooms.length > 0 ? onLessonClassrooms[0] : false
}

const attendLesson = async ({ lessonId, classroomName }) => {
  const { code } = await customGot(api.attendLesson, {
    method: 'POST',
    json: { lessonId, source: 5 },
  }).json()

  if (code === 0) {
    sendNotify('YuKeTang: success', classroomName)
  } else {
    sendNotify('YuKeTang: fail', classroomName)
  }
}

const execCheckIn = async () => {
  console.log(`Number of executions: ${++count}`)
  const lessonInfo = await getOnLessonId()

  if (!lessonInfo && count < times) {
    setTimeout(execCheckIn, 1000 * 60 * 5)
    return
  } else if (count === times) {
    sendNotify('YuKeTang: fail', 'Not Found Online Class')
    return
  }

  attendLesson(lessonInfo)
}

const startUp = async () => {
  const { username, password } = process.env
  await login(username, password)
  execCheckIn()
}

startUp()
