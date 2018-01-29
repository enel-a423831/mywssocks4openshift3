cd "$(dirname "$0")" || exit
#. tsocks -on
export ftp_proxy=http://my-proxy:3128
export http_proxy=$ftp_proxy
export https_proxy=$ftp_proxy
if ! oc whoami | egrep '^a423831.enel@gmail.com$' ; then
	oc login https://api.starter-us-west-1.openshift.com:443 --username=a423831.enel@gmail.com --password=EnellE00 || exit
fi
if ! oc project | grep '[" ]mywssocks[" ]' ; then
	oc project mywssocks || exit
fi
while true ; do oc logs -f dc/mywssocks ; done
