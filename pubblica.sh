cd "$(dirname "$0")" || exit
for i in ../../../*/"$(basename "$(dirname "$(pwd)")")"/"$(basename "$(pwd)")" ; do
	if [ "$(cd $i && pwd)" != "$(pwd)" ]; then
		echo "##### sync with $(cd $i && pwd) ..."
		[ -d "$(cd $i && pwd)"/modules ] || mkdir "$(cd $i && pwd)"/modules || exit
		[ -d modules ] || mkdir modules || exit
		rsync -rvuc --exclude '.*' "$(cd $i && pwd)"/modules/ modules/ || exit
		rsync -rvuc --exclude '.*' modules/ "$(cd $i && pwd)"/modules/ || exit
		echo "##### sync with $(cd $i && pwd) DONE."
	fi
done
. tsocks -on
#if ! rhc account </dev/null | grep "$(basename "$(dirname "$(pwd)")")" ; then
#        echo "
#yes" | rhc setup -l $(basename "$(dirname "$(pwd)")") -p EnellE00 || exit
#        rhc account </dev/null | grep "$(basename "$(dirname "$(pwd)")")" || exit
#fi
#git add . || exit
#git commit -m 'My changes' || exit
#git push || exit
#rhc tail "$(basename "$(pwd)")"
if ! oc whoami | egrep '^a423831.enel@gmail.com$' ; then
	oc login https://api.starter-us-west-1.openshift.com:443 --username=a423831.enel@gmail.com --password=EnellE00 || exit
fi
if ! oc project | grep '[" ]mywssocks[" ]' ; then
	oc project mywssocks || exit
fi
git add . || exit
git commit -m 'My changes' || exit
#git push
oc start-build mywssocks --follow || exit
oc logs -f dc/mywssocks || exit

