#!/usr/bin/env bash

sudo apt-get install -y apache2 libapache2-mod-fastcgi -y

sudo apt-get install python-software-properties software-properties-common -y
sudo LC_ALL=C.UTF-8 add-apt-repository ppa:ondrej/php
sudo apt-get update

sudo cp /var/www/steam_projects/steam-bots/development/vagrant/www.conf /etc/apache2/sites-available/www.conf
sudo ln -sf /etc/apache2/sites-available/www.conf /etc/apache2/sites-enabled/www.conf

sudo a2enmod actions fastcgi alias rewrite proxy_fcgi setenvif
sudo service apache2 restart

exit 0;