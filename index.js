#!/usr/bin/env node

const Shrimpit = require("./shrimpit");

const shrimpit = new Shrimpit(process.argv)

shrimpit.exec()
