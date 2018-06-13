import * as fs from 'fs';
import { promisify } from 'util';
import * as path from 'path';
import { Builder, parseString } from 'xml2js';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const XMLBuilder = new Builder();
const XMLParse = promisify(parseString);

async function buildIcons (resolution: number) {
  const icons = {
    'iconDefinitions': {
      'Shark.Folder': {
        "iconPath": `./images/${resolution}/Folder.svg`
      },
      'Shark.File': {
        "iconPath": `./images/${resolution}/File.svg`
      }
    },
    'rootFolder': 'Shark.Folder',
    'rootFolderExpanded': 'Shark.Folder',
    'folder': 'Shark.Folder',
    'folderExpanded': 'Shark.Folder',
    'file': 'Shark.File'
  };
  // Copy Icons
  await copy(
    path.resolve(__dirname, `${resolution}/File.svg`), 
    path.resolve(`fileicons/images/${resolution}/File.svg`)
  )
  await copy(
    path.resolve(__dirname, `${resolution}/Folder.svg`), 
    path.resolve(`fileicons/images/${resolution}/Folder.svg`)
  )
  return icons;
}

async function copy (target: string, dest: string) {
  return fs
    .createReadStream(target)
    .pipe(fs.createWriteStream(dest));
}

async function readSVG (filePath: string) {
  const fileSVGBuffer = await readFile(filePath);
  const fileSVGContent = fileSVGBuffer.toString();
  return await XMLParse(fileSVGContent);
}

async function buildFileIcons (
  resolution: number,
  containerWidth: number,
  containerHeight: number,
  containerX: number,
  containerY: number
) {
  const fileIcons = {
    'iconDefinitions': {},
    'fileExtensions': {},
    'fileNames': {},
    'languageIds': {}
  }
  const fileTokens = require('./file-tokens.json');
  const filePath = path.resolve(__dirname, `${resolution}/File.svg`);
  const fileSVG = await readSVG(filePath);
  
  await fileTokens.reduce((promise, token) => {
    return promise.then(() => { 
      return new Promise(async (resolve) => {
        let fileTokenSVG = Object.assign({}, fileSVG);
        let fileIconPath = path.resolve(__dirname, `${resolution}/icons/${token.definition}.svg`);
        let fileIconSVG = await readSVG(fileIconPath);
        if (!fileTokenSVG.svg.defs) { 
          fileTokenSVG.svg.defs = [{}];
        }
        // Add Symbol Definition
        Object.assign(fileTokenSVG.svg.defs[0], {
          symbol: [{
            $: {
              id: 'FileIcon'
            },
            g: fileIconSVG.svg.g
          }]
        });
        // Place Symbol
        Object.assign(fileTokenSVG.svg, {
          use: [{
            $: {
              'x': containerX,
              'y': containerY,
              'width': containerWidth,
              'height': containerHeight,
              'xlink:href': '#FileIcon'
            }
          }]
        })
        // Save File
        const fileXMLContent = XMLBuilder.buildObject(fileTokenSVG);
        const fileXMLPath = path.resolve(`fileicons/images/${resolution}/File-${token.definition}.svg`);
        await writeFile(fileXMLPath, fileXMLContent);
        // Add Definitions
        const iconTokenName = `Shark.File.${token.definition}`;
        fileIcons.iconDefinitions[iconTokenName] = {
          iconPath: `./images/${resolution}/File-${token.definition}.svg`
        };
        if (token.fileExtension) {
          fileIcons.fileExtensions[token.fileExtension] = iconTokenName;
        }
        if (token.languageId) {
          fileIcons.languageIds[token.languageId] = iconTokenName;
        }
        if (token.fileName) {
          fileIcons.fileNames[token.fileName] = iconTokenName;
        }
        resolve(iconTokenName);
      });
    })
  }, Promise.resolve());
  return fileIcons;
}

function merge (...items) {
  const master = items.shift();
  items.reduce((previous, current) => {
    Object
      .keys(current)
      .filter((name) => {
        const value = current[name];
        return previous[name] &&
          typeof value == 'object' && 
          value.constructor == Object;
      })
      .forEach((name: string) => {
        current[name] = merge(previous[name], current[name]);
      });
    return Object.assign(previous, current);
  }, master);
  return master;
}

async function build () {
  const iconTheme = {};
  const icons = await buildIcons(24);
  const fileIcons = await buildFileIcons(24, 11.91, 10.71, 6.02, 10.16);
  merge(
    iconTheme, 
    icons,
    fileIcons
  );
  const themePath = path.resolve(`fileicons/fileicon-theme.json`);
  await writeFile(themePath, JSON.stringify(iconTheme, null, 2));
}

build();