const Telgegraf = require('telegraf')
const TelegrafI18n = require('telegraf-i18n')
const mongo = require('mongodb')
const randomstring = require('randomstring')
const path = require('path')
const data = require('./data')
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')
const session = require('telegraf/session')
const Stage = require('telegraf/stage')
const superWizard = require('./wizard')
const { leave } = Stage
const bot = new Telgegraf(data.token)
let db


mongo.connect(data.mongoLink, {useNewUrlParser: true}, (err, client) => {
  if (err) {
    sendError(err)
  }

  db = client.db('giway')
  bot.startPolling()
})

const i18n = new TelegrafI18n({
  defaultLanguage: 'en',
  allowMissing: false, 
  directory: path.resolve(__dirname, 'locales')
})


const stage = new Stage()
stage.register(superWizard)

bot.use(i18n.middleware())
bot.use(session())
bot.use(stage.middleware())


bot.start(({ i18n, replyWithHTML }) => {
  replyWithHTML(
    i18n.t('hello'),
    Extra
      .markup(
        Markup.keyboard([i18n.t('buttons.generate'), i18n.t('buttons.myPosts')], { columns: 1 })
        .resize()
        .oneTime()
      )
    )
})

bot.hears(TelegrafI18n.match('buttons.generate'), (ctx) => {
  ctx.scene.enter('generating')
})

bot.action('correct', async ({ i18n, answerCbQuery, replyWithHTML, session }) => {
  answerCbQuery()
    .catch((err) => { return })
    
  let tokenExist = true
  let token
  
  while (tokenExist) {
    token = randomstring.generate(16)
    const dbTokens = await db.collection('allPosts').find({token: token}).toArray()
    dbTokens.length === 0 ? tokenExist = false : false
  }
  
  replyWithHTML(
    i18n.t('ready', { token: token }),
    Extra 
      .markup(Markup.inlineKeyboard([
        [Markup.switchToChatButton(i18n.t('buttons.share'), token)]
      ]))
      .HTML()
  )

  db.collection('allPosts').insertOne({
    token: token,
    postText: session.postText,
    buttonText: session.buttonText,
    members: []
  })
})

bot.action('again', ({ wizard }) => {
  ctx.answerCbQuery()
  return wizard.back()
})

bot.action('leer', ({ i18n, answerCbQuery }) => {
  return answerCbQuery(i18n.t('leerButton'))
    .catch((err) => { return })
})

bot.action(/part_*/, async (ctx) => {
  ctx.answerCbQuery('lol', true)
})


bot.on('inline_query', async (ctx) => {
  if (ctx.inlineQuery.query.length !== 16) {
    return 
  }

  const dbData = await db.collection('allPosts').find({token: ctx.inlineQuery.query}).toArray()
  if (dbData.length === 0) {
    return
  }

  const post = [{
    type: 'article',
    id: dbData[0].token,
    title: dbData[0].postText.substr(0, 20) + '...',
    input_message_content: {
      message_text: dbData[0].postText,
      parse_mode: 'html'
    },
    reply_markup: {
      inline_keyboard: [[{text: dbData[0].buttonText, callback_data: `part_${dbData[0].token}`}]]
    }
  }]

  ctx.answerInlineQuery(post)
})
