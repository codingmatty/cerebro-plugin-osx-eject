'use strict';
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const plist = require('plist');
const { shellCommand } = require('cerebro-tools');
const ejectMediaIcon = require('./EjectMediaIcon.png');
const externalDiskIcon = require('./ExternalDiskIcon.png');
const noDrivesIcon = require('./NoDrivesIcon.png');


const plugin = ({term, display, actions}) => {
  const match = /eject\s(.*)/.exec(term);
  if (match) {
    shellCommand('diskutil list -plist')
      .then((output) => plist.parse(output))
      .then((diskInfo) => {
        // match volume names with disk/partition details
        const volumeDetails = _.compact(diskInfo.VolumesFromDisks.map((volumeName) => {
          let currentVolumeDetails = _.find(diskInfo.AllDisksAndPartitions, { VolumeName: volumeName });
          if (!currentVolumeDetails) {
            // look in partitions of volumes:
            const allPartitions = _.flatten(diskInfo.AllDisksAndPartitions.map(({ Partitions }) => Partitions));
            currentVolumeDetails = _.find(allPartitions, { VolumeName: volumeName });
          }
          return currentVolumeDetails;
        }))
          .filter(({ MountPoint }) => MountPoint !== '/') // filter out root volume
          .map((details) => Object.assign({}, details, { // determine icon for each volume
            icon: getIconPath(details.MountPoint)
          }));

        if (volumeDetails.length) {
          display([{
            icon: ejectMediaIcon,
            title: 'Eject All',
            subtitle: 'Unmount and eject all external disks and partitions',
            onSelect: () => volumeDetails.forEach(ejectDrive)
          }].concat(volumeDetails.map(({ icon, VolumeName, MountPoint, DeviceIdentifier }) => ({
            icon,
            title: VolumeName,
            subtitle: `Unmount and eject ${MountPoint}`,
            onSelect: () => ejectDrive({ DeviceIdentifier, VolumeName })
          }))));
        } else {
          display({
            icon: noDrivesIcon,
            title: 'No Drives to Eject'
          });
        }
      });
  }
};

module.exports = {
  fn: plugin,
  keyword: 'eject',
  name: 'Eject Disks and Partitions'
}

function getIconPath(mountPoint) {
  const customIconPath = path.resolve(mountPoint, '.volumeicon.icns');
  if (fs.existsSync(customIconPath)) {
    return customIconPath;
  }
  return externalDiskIcon;
}

function ejectDrive({ DeviceIdentifier, VolumeName }) {
  shellCommand(`diskutil unmount ${DeviceIdentifier}`).then(() => {
    new Notification('Drive Ejected', {
      body: `${VolumeName} has been ejected.`
    });
  });
}
