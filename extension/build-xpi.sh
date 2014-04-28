#!/bin/sh

TOPSRC=$PWD
DIST=$TOPSRC/dist

if [[ ! -d $DIST ]]; then
  mkdir $DIST
fi

ln -sf $TOPSRC/chrome $DIST
ln -sf $TOPSRC/install.rdf $DIST
ln -sf $TOPSRC/chrome.manifest $DIST
ln -sf $TOPSRC/../src/ssdp.js $DIST/chrome/content/

cd $DIST
zip -r dlna-demo.xpi ./
