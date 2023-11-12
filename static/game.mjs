const { abs, floor, min, max, cos, atan2, PI, random } = Math

import Two from './two.min.mjs'
import * as utils from './utils.mjs'
const { Group, GameAudio, addTo, urlAbsPath, addToLoads, checkAllLoadsDone, checkHit } = utils


const WIDTH = 800
const HEIGHT = 600
const FPS = 60  // hardcoded in Twojs
const BACKGROUND_COLOR = "#aaf"

const PLAYGROUND_MIN_Y = 60
const PLAYGROUND_MAX_Y = 520
const VICTORY_SCORE = 20

const HERO_SIZE = 70
const HERO_MAX_SPD = 200
const HERO_DEC = 300
const HERO_PARALYSIS_DUR = 2

const STAR_SIZE = 70
const STAR_SPEED = 50
const STAR_SPAWN_PERIOD = 2

const MONSTER_SIZE = 60
const MONSTER_SPEED = 150
const MONSTER_SPAWN_PERIOD_RANGE = [1, 4]
const MONSTER_JUMP_DURATION = 1
const MONSTER_JUMP_PERIOD_RANGE = [1.5, 3]


function startGame(wrapperEl, gameWs) {
  return new Game(wrapperEl, gameWs)
}


class Game extends Two {

  constructor(wrapperEl, gameWs) {
    super({
      type: Two.Types.webgl,
      width: WIDTH,
      height: HEIGHT,
    })
    utils.fitTwoToEl(this, wrapperEl, { background: BACKGROUND_COLOR })

    this.roomId = gameWs.roomId
    this.joypadUrl = gameWs.joypadUrl
    this.joypadUrlQrCode = gameWs.joypadUrlQrCode
    this.sendInput = gameWs.sendInput
    this.sendState = gameWs.sendState

    this.players = {}

    this.sceneGroup = addTo(this, new Group())
    this.setScene(new GameScene(this))
  
    this.bind("update", (frameCount, timeDelta) => {
      const time = frameCount / FPS
      this.mainScene.update(time)
    })
    
    this.play()
  }

  syncPlayers(players) {
    try {
      this.players = players
      this.mainScene.syncPlayers()
    } catch(err) {
      console.log(err)
    }
  }

  onJoypadInput(playerId, kwargs) {
    try {
      this.mainScene.onJoypadInput(playerId, kwargs)
    } catch(err) {
      console.log(err)
    }
  }

  setScene(scn) {
    if(this.mainScene !== undefined) this.mainScene.remove()
    this.mainScene = addTo(this.sceneGroup, scn)
  }
}


// Fluffing a Duck Kevin MacLeod (incompetech.com)
// Licensed under Creative Commons: By Attribution 3.0 License
// http://creativecommons.org/licenses/by/3.0/
// Music promoted by https://www.chosic.com/free-music/all/
const musicIntro = addToLoads(new GameAudio(urlAbsPath("assets/Fluffing-a-Duck(chosic.com).opus"), { volume: .2 }))

// Superepic by Alexander Nakarada | https://creatorchords.com/
// Music promoted by https://www.chosic.com/free-music/all/
// Attribution 4.0 International (CC BY 4.0)
// https://creativecommons.org/licenses/by/4.0/
const music = addToLoads(new GameAudio(urlAbsPath("assets/alexander-nakarada-superepic(chosic.com).opus"), { volume: .2 }))

const ouchAud = addToLoads(new GameAudio(urlAbsPath("assets/ouch.opus"), { volume: .5 }))
const coinAud = addToLoads(new GameAudio(urlAbsPath("assets/coin.opus"), { volume: 1 }))




class GameScene extends Group {

  constructor(game) {
    super()
    this.game = game
    
    this.background = addTo(this, new Group())
    this.stars = addTo(this, new Group())
    this.monsters = addTo(this, new Group())
    this.heros = addTo(this, new Group())
    this.notifs = addTo(this, new Group())

    this.addLoadingTexts()
  }

  addLoadingTexts() {
    this.loadingTexts = addTo(this.notifs, new Group())
    addTo(this.loadingTexts, new Two.Text(
      "LOADING...",
      WIDTH / 2, HEIGHT / 2, { fill: "white", size: 20 }
    ))
  }

  checkReady() {
    if(!this.ready && checkAllLoadsDone()) {
      this.ready = true
      this.loadingTexts.remove()
      this.setStep("INTRO")
    }
    return this.ready
  }

  setStep(step) {
    if(!this.ready || step === this.step) return
    this.step = step
    if(step === "INTRO") {
      this.addBackground()
      this.syncPlayers()
      this.addIntroTexts()
      musicIntro.currentTime = 0; musicIntro.play({ loop: true })
    } else if(step === "GAME") {
      this.introTexts.remove()
      addTo(this.notifs, new CountDown(3))
      this.nextStarTime = this.time + 3
      this.nextMonsterTime = this.time + 3
      this.scoresPanel = addTo(this.notifs, new ScoresPanel(this))
      musicIntro.pause()
      music.currentTime = 0; music.play({ loop: true })
      this.game.sendInput({ step: "GAME" })
    } else if(step === "VICTORY") {
      this.addVictoryTexts()
      this.game.sendInput({ step: "VICTORY" })
    }
    this.game.sendState({ step })
  }

  update(time) {
    if(!this.checkReady()) return
    this.startTime ||= time
    this.time = time - this.startTime
    const { step } = this
    if(step === "INTRO" || step === "GAME") {
      this.heros.update(this.time)
    }
    if(step === "GAME") {
      this.monsters.update(this.time)
      this.stars.update(this.time)
      this.mayAddStar()
      this.mayAddMonster()
      this.checkHerosStarsHit()
      this.checkHerosMonstersHit()
    }
    this.notifs.update(this.time)
  }

  addBackground() {
    const background = addTo(this.background, new Two.Sprite(
      urlAbsPath("assets/background.jpg"),
      WIDTH / 2, HEIGHT / 2,
    ))
    // background.scale = 2.5
  }

  addIntroTexts() {
    this.introTexts = addTo(this.notifs, new Group())
    const textArgs = { size: 30, fill: "black", alignment: "center" }
    addTo(this.introTexts, new Two.Text(
      "Pas Touche Aux Poissons",
      WIDTH / 2, HEIGHT / 2 - 200,
      { ...textArgs, size: 60 }
    ))
    addTo(this.introTexts, new Two.Text(
      "Join the game:",
      WIDTH / 2, HEIGHT / 2 - 130,
      { ...textArgs, size: 40 }
    ))
    addTo(this.introTexts, new Two.Sprite(
      new Two.Texture(this.game.joypadUrlQrCode),
      WIDTH / 2, HEIGHT / 2,
    )).scale = 200 / 200
    addTo(this.introTexts, new Two.Text(
      this.game.joypadUrl,
      WIDTH / 2, HEIGHT / 2 + 130,
      textArgs
    ))
  }

  syncPlayers() {
    if(!this.ready) return
    for(const playerId in this.game.players) if(this.step === "INTRO" && !this.getHero(playerId)) this.addHero(playerId)
    for(const hero of this.heros.children) if(!this.game.players[hero.playerId]) this.rmHero(hero.playerId)
  }
  addHero(playerId) {
    addTo(this.heros, new Hero(
      this,
      playerId,
      (.25 + .5 * random()) * WIDTH,
      (.25 + .5 * random()) * HEIGHT,
    ))
  }
  getHero(playerId) {
    const res = this.heros.children.filter(h => h.playerId === playerId)
    return res ? res[0] : null
  }
  rmHero(playerId) {
    this.getHero(playerId).remove()
  }

  mayAddStar() {
    if(this.time > this.nextStarTime) {
      addTo(this.stars, new Star())
      this.nextStarTime = this.time + STAR_SPAWN_PERIOD
    }
  }

  mayAddMonster() {
    if(this.time > this.nextMonsterTime) {
      addTo(this.monsters, new Monster())
      this.nextMonsterTime = this.time + MONSTER_SPAWN_PERIOD_RANGE[0] + random() * (MONSTER_SPAWN_PERIOD_RANGE[1] - MONSTER_SPAWN_PERIOD_RANGE[0])
    }
  }

  checkHerosStarsHit() {
    for(const hero of this.heros.children) {
      if(hero.step === "move") {
        for(const star of this.stars.children) {
          if(checkHit(hero, star)) {
            addTo(this.notifs, new Notif(
              (hero.score ? `${hero.score} ` : "") + "+ 1",
              star.translation.x, star.translation.y,
              { fill: "gold" }
            ))
            star.onHeroHit(hero)
            hero.onStarHit(star)
            this.scoresPanel.syncScores()
            if(hero.score >= VICTORY_SCORE) {
              this.winnerHero = hero
              this.setStep("VICTORY")
            }
          }
        }
      }
    }
  }

  checkHerosMonstersHit() {
    for(const hero of this.heros.children) {
      if(hero.step === "move") {
        for(const monster of this.monsters.children) {
          if(monster.attacking) {
            if(checkHit(hero, monster)) {
              addTo(this.notifs, new Notif(
                "- 1",
                hero.translation.x, hero.translation.y,
                { fill: "red" }
              ))
              hero.onMonsterHit(this.time)
              this.scoresPanel.syncScores()
            }
          }
        }
      }
    }
  }

  addVictoryTexts() {
    const player = this.game.players[this.winnerHero.playerId]
    const txtArgs = { fill: "black" }
    this.victoryTexts = addTo(this.notifs, new Group())
    addTo(this.victoryTexts, new Two.Text(
      "VICTORY !",
      WIDTH / 2, HEIGHT / 3,
      { ...txtArgs, size: 80 }
    ))
    addTo(this.victoryTexts, new Two.Text(
      `Winner: ${player.name}`,
      WIDTH / 2, HEIGHT / 2,
      { ...txtArgs, size: 40 }
    ))
  }

  onJoypadInput(playerId, kwargs) {
    const hero = this.getHero(playerId)
    hero.onJoypadInput(kwargs)
    if(kwargs.ready !== undefined) {
      if(this.step === "INTRO") this.setHeroReady(hero, kwargs.ready)
    }
    if(kwargs.restart) {
      if(this.step === "VICTORY") this.restart()
    }
  }

  setHeroReady(hero, ready) {
    hero.ready = ready
    if(this.step === "INTRO") {
      let allReady = true
      for(const h of this.heros.children) allReady &= h.ready
      if(allReady) this.setStep("GAME")
    }
  }

  restart() {
    this.game.setScene(new GameScene(this.game))
  }

  remove() {
    super.remove()
    musicIntro.pause()
    music.pause()
  }
}


const heroCanvas = {
  base: addToLoads(utils.newCanvasFromSrc(urlAbsPath("assets/duck.png"))),
  get: function(dirX, color) {
    const key = `trans:${dirX},${color}`
    if(!this[key]) {
      this[key] = utils.cloneCanvas(this.base, { flipX: (dirX === 1)})
      if(color) utils.colorizeCanvas(this[key], color)
    }
    return this[key]
  }
}


class Hero extends Group {

  constructor(scn, playerId, x, y) {
    super()
    this.scene = scn
    this.game = scn.game
    this.playerId = playerId
    const player = this.game.players[playerId]
    const { name, color } = player

    this.time = 0
    this.translation.x = x
    this.translation.y = y
    this.width = this.height = HERO_SIZE
    this.spdX = this.spdY = 0
    this.step = "move"
    this.moveTime = -1
    this.lastInput = { time: -1 }
    this.score = 0
    this.attackTime = 0

    this.bodyImg = addTo(this, new Two.ImageSequence([
      new Two.Texture(heroCanvas.get(-1, color)),
      new Two.Texture(heroCanvas.get(1, color)),
      new Two.Texture(heroCanvas.get(-1, "")),
      new Two.Texture(heroCanvas.get(1, "")),
    ], 0, 0))
    this.bodyImg.scale = HERO_SIZE / 100

    addTo(this, new Two.Text(
      name,
      0, 60,
      { fill: "black", size: 30 }
    ))
  }

  update(time) {
    this.time = time
    if(this.step === "move") {
      this.visible = true
      if(time - this.moveTime >= .6 && time - this.lastInput.time < .2) {
        this.spdX = HERO_MAX_SPD * this.lastInput.dirX
        this.spdY = HERO_MAX_SPD * this.lastInput.dirY
        this.moveTime = time
      }
      let minX = HERO_SIZE/2, maxX = WIDTH - HERO_SIZE/2
      let minY = PLAYGROUND_MIN_Y + HERO_SIZE/2, maxY = PLAYGROUND_MAX_Y - HERO_SIZE/2
      for(const hero of this.scene.heros.children) {
        if(hero === this) continue
        const { x, y } = this.translation, { x: hx, y: hy } = hero.translation
        if(abs(x - hx) < HERO_SIZE) {
          if(hy > y) maxY = min(maxY, hy - HERO_SIZE)
          else minY = max(minY, hy + HERO_SIZE)
        }
        if(abs(y - hy) < HERO_SIZE) {
          if(hx > x) maxX = min(maxX, hx - HERO_SIZE)
          else minX = max(minX, hx + HERO_SIZE)
        }
      }
      this.translation.x = bound(this.translation.x + this.spdX / FPS, minX, maxX)
      this.translation.y = bound(this.translation.y + this.spdY / FPS, minY, maxY)
      this.spdX = sumTo(this.spdX, HERO_DEC / FPS, 0)
      this.spdY = sumTo(this.spdY, HERO_DEC / FPS, 0)
      if(this.spdX < 0) this.bodyImg.index = 0
      if(this.spdX > 0) this.bodyImg.index = 1
    } else if(this.step === "attacked") {
      this.visible = (time * 4) % 1 > .5
      if(time > this.attackTime + HERO_PARALYSIS_DUR) {
        this.step = "respawn"
        this.translation.x = -HERO_SIZE
        this.spdX = HERO_MAX_SPD
        this.spdY = 0
        this.bodyImg.index = 1
      }
    } else if(this.step === "respawn") {
      this.visible = true
      this.translation.x += this.spdX / FPS
      if(this.translation.x >= HERO_SIZE / 2) this.step = "move"
    }
  }

  getHitBox() {
    return {
      left: this.translation.x - HERO_SIZE/2,
      top: this.translation.y,
      width: HERO_SIZE,
      height: HERO_SIZE / 2,
    }
  }

  onMonsterHit(time) {
    this.step = "attacked"
    this.attackTime = time
    this.score = max(0, this.score - 1)
    this.bodyImg.index += 2 
    ouchAud.replay()
  }

  onStarHit(star) {
    this.score += 1
  }

  onJoypadInput(kwargs) {
    if(kwargs.dirX !== undefined) {
      this.lastInput.dirX = kwargs.dirX
      this.lastInput.dirY = kwargs.dirY
      this.lastInput.time = this.time
    }
  }
}


class Star extends Two.Sprite {

  constructor(y) {
    super(
      urlAbsPath("assets/star.png"),
      WIDTH + 50,
      PLAYGROUND_MIN_Y + STAR_SIZE/2 + (PLAYGROUND_MAX_Y - PLAYGROUND_MIN_Y - STAR_SIZE) * random()
    )
    this.width = this.height = STAR_SIZE
    this.scale = STAR_SIZE / 100
  }

  update(time) {
    this.translation.x -= STAR_SPEED / FPS
    if(this.x < -STAR_SIZE) this.remove()
  }

  getHitBox() {
    const width = this.width * .4
    const height = this.height * .4
    return {
      left: this.translation.x - width/2,
      top: this.translation.y - height/2,
      width,
      height,
    }
  }

  onHeroHit(hero) {
    this.remove()
    coinAud.replay()
  }
}



// new Two.ImageSequence([
//   new Two.Texture(heroCanvas.get(-1, color)),
//   new Two.Texture(heroCanvas.get(1, color)),
// ], 0, 0))

const monterCanvas = {
  base: addToLoads(utils.newCanvasFromSrc(urlAbsPath("assets/piranha.png"))),
  get: function(dy) {
    const key = `trans:${dy}`
    if(!this[key]) this[key] = utils.cloneCanvas(this.base, { dy })
    return this[key]
  }
}

class Monster extends Two.ImageSequence {

  constructor() {
    const baseY = PLAYGROUND_MIN_Y + MONSTER_SIZE/2 + (PLAYGROUND_MAX_Y - PLAYGROUND_MIN_Y - MONSTER_SIZE) * random()
    super([
        new Two.Texture(monterCanvas.get(55)),
        new Two.Texture(monterCanvas.base),
      ],
      WIDTH + 50,
      baseY
    )
    this.baseY = baseY
    this.width = this.height = MONSTER_SIZE
    this.scale = MONSTER_SIZE / 100
    this.jumpPeriod = MONSTER_JUMP_PERIOD_RANGE[0] + random() * (MONSTER_JUMP_PERIOD_RANGE[1] - MONSTER_JUMP_PERIOD_RANGE[0])
    this.jumpTime = -this.jumpPeriod
    this.attacking = false
  }

  update(time) {
    this.translation.x -= MONSTER_SPEED / FPS
    if(this.translation.x > WIDTH / 2 && time - this.jumpTime >= this.jumpPeriod) this.jumpTime = time
    const jumpTimeF = (time - this.jumpTime) / MONSTER_JUMP_DURATION
    if(jumpTimeF >= 0 && jumpTimeF < MONSTER_JUMP_DURATION) {
      this.index = 1
      this.translation.y = this.baseY - (-.7 + cos(1 - 2 * jumpTimeF)) * MONSTER_SIZE
      this.rotation = (.5 - jumpTimeF)
      this.attacking = true
    } else {
      this.index = 0
      this.translation.y = this.baseY
      this.rotation = 0
      this.attacking = false
    }
    if(this.x < -MONSTER_SIZE) this.remove()
  }

  getHitBox() {
    const width = this.width * .7
    const height = this.height * .7
    return {
      left: this.translation.x - width/2,
      top: this.translation.y - height/2,
      width,
      height,
    }
  }
}


class CountDown extends Group {

  constructor(startVal, next) {
    super()
    this.translation.x = WIDTH / 2
    this.translation.y = HEIGHT / 2
    this.startVal = startVal
    this.val = startVal + 1
    this.next = next
  }

  update(time) {
    super.update(time)
    this.startTime ||= time
    const age = time - this.startTime
    if(age > this.startVal - this.val + 1) {
      this.val -= 1
      this.addNumber()
    }
    if(age > this.startVal) {
      this.remove()
      this.next && this.next()
    }
  }

  addNumber() {
    const number = addTo(this, new Two.Text(this.val, 0, 0, {
      fill: "black", size: 100
    }))
    number.update = function(time) {
      this.startTime ||= time
      const age = time - this.startTime
      this.scale = 1 + age * 6
      if(age > .5) this.remove()
    }
  }
}


class ScoresPanel extends Group {

  constructor(scn) {
    super()
    this.scene = scn
    this.game = scn.game
    this.heros = scn.heros.children
    this.nbScores = min(10, this.heros.length)

    this.translation.x = 10
    this.translation.y = 10
    this.width = 160
    this.height = (this.nbScores) * 25 + 15

    const background = addTo(this, new Two.Rectangle(this.width/2, this.height/2, this.width, this.height))
    background.fill = 'rgba(0, 0, 0, 0.2)'

    this.scoreTexts = addTo(this, new Group())
    for(let i=0; i<this.nbScores; ++i) {
      addTo(this.scoreTexts, new Two.Text(
        "",
        this.width/2, 20 + i * 25,
        { fill: "black", size: 24 }
      ))
    }

    this.syncScores()
  }

  syncScores() {
    const sortedHeros = [...this.heros]
    sortedHeros.sort((h1, h2) => {
      if(h1.score > h2.score) return -1
      if(h1.score < h2.score) return 1
      const p1 = this.game.players[h1.playerId]
      const p2 = this.game.players[h1.playerId]
      if(p1.name > p2.name) return -1
      if(p1.name < p2.name) return 1
      return 0
    })
    for(let i=0; i<this.nbScores; ++i) {
      let txt = ""
      if(i < sortedHeros.length) {
        const hero = sortedHeros[i]
        const player = this.game.players[hero.playerId]
        txt = `${player.name}: ${hero.score}`
      }
      this.scoreTexts.children[i].value = txt
    }
  }
}


// utils //////////////////////////


class Notif extends Two.Text {

  constructor(txt, x, y, textKwargs) {
    super(
      txt, x, y,
      { size: 30, ...textKwargs }
    )
  }

  update(time) {
    this.translation.y -= 50 / FPS
    this.removeTime ||= time + 1
    if(time > this.removeTime) this.remove()
  }
}

function sumTo(val, dVal, toVal) {
  const diff = toVal - val
  if(abs(diff) <= dVal) return toVal
  if(diff > 0) return val + dVal
  else return val - dVal
}

function bound(val, minVal, maxVal) {
  return max(min(val, maxVal), minVal)
}


export { startGame }
