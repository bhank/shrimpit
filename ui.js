#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const util = require('util')

const babylon = require('babylon')
const chalk = require('chalk')
const cheerio = require('cheerio')
const merge = require('lodash.merge')
const traverse = require('babel-traverse').default

const Shrimpit = require("./shrimpit");

const log = i => console.log(i, '\n')
const objectLog = o => console.log(util.inspect(o, false, null, true), '\n')

class Ui {

  cleanSrc (src) {
    return src.filter(s => {
      const flagRegex = /^--(\w+)$/i

      if (flagRegex.test(s)) {
        switch (s.match(flagRegex)[1]) {
          case 'help':
            this.displayHelp = true
            break

          case 'tree':
            this.displayTree = true
            break

          default:
            this.displayUnknownFlag = true
        }
      }

      return !flagRegex.test(s)
    })
  }

  error (e) {
    log(chalk.red(`! ${e} `))

    process.exit(1)
  }

  exec (argv) {
    // Remove execPath and path from argv.
    const src = this.cleanSrc(argv.slice(2));

    log(chalk.white.bgMagenta.bold(' Shrimpit! '))

    if (this.displayUnknownFlag) return this.renderUnknownFlag()

    if (this.displayHelp) return this.renderHelp()

    this.shrimpit = new Shrimpit();
    this.shrimpit.exec(src);

    if (this.displayTree) this.renderTree()

    this.renderUnused()
  }


  renderHelp () {
    log([
      'Usage:',
      '  shrimpit [<file | directory> ...]',
      '',
      'Options:',
      ' --tree  Output the complete files tree',
      '',
      'Examples:',
      '  shrimpit test/a/a2.js',
      '  shrimpit test'
    ].join('\n'))
  }

  renderTree () {
    log(chalk.magenta.bgWhite(' > Files tree '))

    objectLog(this.shrimpit.filesTree)
  }

  renderUnknownFlag () {
    this.error('Unknown flag provided, try --help.')
  }

  renderUnused () {
    const unresolved = this.shrimpit.getUnresolved();

    log(chalk.magenta.bgWhite(' > Unused exports '))

    if (unresolved.size === 0) log(chalk.yellow('All Clear Ahead, Captain.'))
    else objectLog([...unresolved].map(m => {
      const detail = this.shrimpit.exportDetails[m];
      if(!detail) return m;
      return `${detail.fileName}(${detail.line},${detail.column}): ${detail.exportName}`;
    }))
  }
}

module.exports = Ui;