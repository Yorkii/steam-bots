#!/usr/bin/env bash

sudo apt-get install curl git zip -y

sudo curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.0/install.sh | sudo bash
export NVM_DIR="$HOME/.nvm"
sudo [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

source ~/.profile

sudo chmod 0777 $HOME/.nvm

nvm install 6
nvm use 6

npm install gulp -g

exit 0;