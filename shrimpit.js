#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const babylon = require('babylon')
const cheerio = require('cheerio')
const merge = require('lodash.merge')
const traverse = require('babel-traverse').default

class Shrimpit {
  constructor () {
    this.allowedTypes = /^\.(jsx?|vue)$/
    this.filesTree = {}
    this.isVueTemplate = /^\.vue$/
    this.modules = {
      exports: [],
      imports: [],
    }
    this.exportDetails = {};

    this.parseOpts = {
      allowImportExportEverywhere: true,
      plugins: [
        'asyncFunctions',
        'asyncGenerators',
        'classConstructorCall',
        'classProperties',
        'decorators',
        'doExpressions',
        'dynamicImport',
        'exponentiationOperator',
        'exportExtensions',
        'flow',
        'functionSent',
        'functionBind',
        'jsx',
        'objectRestSpread',
        'trailingFunctionCommas'
      ],
      sourceType: 'module'
    }
  }

  addDir (extPath) {
    this.updateFilesTree([...this.getDir(extPath), this.getBase(extPath)])
  }

  addFile (extPath) {
    if (!(this.allowedTypes.test(this.getExt(extPath)))) return

    this.updateFilesTree([...this.getDir(extPath), this.getBase(extPath)], this.walkAST(extPath))
  }

  dedupe (array) {
    // Dedupe with a set.
    return [...new Set(array)]
  }

  deExtensionize (filePath) {
    var deexted = filePath.replace(/\.[^\/\\]+$/, "");
    var deslashedanddeindexed = deexted.replace(/[\\/](index)?$/, "")
    return deslashedanddeindexed
  }

  error (e) {
    console.error(`! ${e} `)

    process.exit(1)
  }

  exec (...src) {
    // Start reading and parsing the directories.
    src.map(target => this.read(null, target))
  }

  fixSlashes(filePath) {
    return filePath.replace(/\\/g, "/");
  }

  getAST (src, path) {
    try {
      return babylon.parse(src, this.parseOpts)
    } catch (e) {
      this.error(`${e} in ${path}`)
    }
  }

  getBase (extPath, dropExt) {
    return dropExt ? path.parse(extPath).name : path.parse(extPath).base
  }

  getDir (extPath) {
    return path.parse(extPath).dir.split(path.sep)
  }

  getExt (extPath) {
    return path.parse(extPath).ext
  }

  isDir (target) {
    try {
      return fs.statSync(target).isDirectory()
    } catch (e) {
      this.error(e)
    }
  }

  isFile (target) {
    try {
      return fs.statSync(target).isFile()
    } catch (e) {
      this.error(e)
    }
  }

  joinPaths (...paths) {
    return path.join(...paths)
  }

  read (rootPath, target) {
    const extPath = path.normalize(
      `${rootPath !== null ? rootPath + '/' : ''}${target}`
    )

    if (this.isDir(extPath)) {
      this.addDir(extPath)

      try {
        fs.readdirSync(extPath).map(file => this.read(extPath, file))
      } catch (e) {
        this.error(e)
      }
    } else if (this.isFile(extPath)) {
      this.addFile(extPath)
    }
  }

  readFile (path) {
    try {
      const content = fs.readFileSync(path, { encoding: 'utf8' })

      return this.isVueTemplate.test(this.getExt(path))
        ? cheerio.load(content)('script').text()
        : content
    } catch (e) {
      this.error(e)
    }
  }

  getUnresolved() {
    const { exports, imports } = this.modules
    let unresolved = new Set(this.dedupe(exports))

    this.dedupe(imports).forEach(i => unresolved.delete(i))

    return [...unresolved];
  }

  getUnresolvedDetail() {
    return this.getUnresolved()
      .map(m => {
        const detail = this.exportDetails[m];
        if(!detail) return m;
        return `${detail.fileName}(${detail.line},${detail.column}): ${detail.exportName}`;
      });
  }

  updateFilesTree (arrayPath, modules = null) {
    const arrayPathCleaned = arrayPath.filter(segment => segment !== '')

    this.filesTree = merge(
      this.filesTree,
      JSON.parse([
        '{',
        arrayPathCleaned.map(segment => `"${segment}"`).join(':{'),
        `:${JSON.stringify(modules)}`,
        '}'.repeat(arrayPathCleaned.length)
      ].join(''))
    )
  }

  walkAST (extPath) {
    const self = this
    let exports = []
    let imports = []

    const defaultExportVisitor = {
      Expression (path) {
        const fileName = self.fixSlashes(self.deExtensionize(extPath));
        const key = fileName;
        exports.push(key);
        self.exportDetails[key] = {
          exportName: "(default)",
          fileName,
          line: path.node.loc.start.line,
          column: path.node.loc.start.column,
        };

        // Stop traversal as an expression was found.
        path.stop()
      },

      Function (path) {
        path.traverse(exportVisitor, true)
      }
    }

    const exportVisitor = {
      Identifier (path) {
        const fileName = self.fixSlashes(self.deExtensionize(extPath));
        const isDefaultExport = path.parentPath.parent.type === "ExportDefaultDeclaration";
        const exportName = isDefaultExport ? "(default)" : path.node.name;
        // TODO: can you import it explicitly by name, as well as importing the default? This assumes default only.
        const key = fileName + (isDefaultExport ? "" : ` ${exportName}`);
        exports.push(key);
        self.exportDetails[key] = {
          exportName,
          fileName,
          line: path.node.loc.start.line,
          column: path.node.loc.start.column,
        };

        // Stop traversal to avoid collecting unwanted identifiers.
        path.stop()
      },

      Statement (path, expectNamedFunction) {
        if (expectNamedFunction) {
          const fileName = self.fixSlashes(self.deExtensionize(extPath));
          const key = fileName;
          exports.push(key);
          self.exportDetails[key] = {
            exportName: "(default)",
            fileName,
            line: path.node.loc.start.line,
            column: path.node.loc.start.column,
          };
        }
      }
    }

    traverse(this.getAST(this.readFile(extPath), extPath), {
      ExportAllDeclaration (path) {
        path.traverse(exportVisitor)
      },

      ExportDefaultDeclaration (path) {
        path.traverse(defaultExportVisitor)
      },

      ExportDefaultSpecifier (path) {
        path.traverse(exportVisitor)
      },

      ExportNamedDeclaration (path) {
        path.traverse(exportVisitor)
      },

      ExportNamespaceSpecifier (path) {
        path.traverse(exportVisitor)
      },

      ExportSpecifier (path) {
        path.traverse(exportVisitor)
      },

      ImportDefaultSpecifier (path) {
        const fileName = self.fixSlashes(self.deExtensionize(self.joinPaths(extPath, '../', path.parent.source.value)));
        imports.push(fileName);
      },

      ImportNamespaceSpecifier (path) {
        const fileName = self.fixSlashes(self.deExtensionize(self.joinPaths(extPath, '../', path.parent.source.value)));
        //imports.push(`${fileName} * as ${path.node.local.name}`); // TODO: should I do something different for *? It could be considered as referencing all exports.
        imports.push(fileName);
      },

      ImportSpecifier (path) {
        const fileName = self.fixSlashes(self.deExtensionize(self.joinPaths(extPath, '../', path.parent.source.value)));
        imports.push(`${fileName} ${path.node.local.name}`);
      }
    })

    exports = this.dedupe(exports)
    this.modules.exports.push(...exports)

    imports = this.dedupe(imports)
    this.modules.imports.push(...imports)

    return { exports, imports }
  }
}

module.exports = Shrimpit;