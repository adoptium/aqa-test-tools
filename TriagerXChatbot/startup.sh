#!/bin/sh

apt update && apt install -y  libjpeg-dev libopenjp2-7-dev libtiff-dev libfreetype6-dev libxcb-randr0-dev libxcb-xtest0-dev libxcb-xinerama0-dev libxcb-shape0-dev libxcb-xkb-dev && gunicorn --bind=0.0.0.0 --timeout 600 main:flask_app