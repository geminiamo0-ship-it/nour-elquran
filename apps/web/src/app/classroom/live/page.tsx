import {ConnectedWaitingRoom} from '@/features/classroom';
/** Signed waiting-room route; role/lesson query is never an authorization proof. */
export default function LiveClassroomPage(){return <ConnectedWaitingRoom/>;}
