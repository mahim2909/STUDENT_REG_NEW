import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';


@Injectable({
  providedIn: 'root'
})
export class DataService {

  private configUrl='http://localhost:3001/';
  constructor(private http: HttpClient) { }

  post(functionName:any, data:any){
    return this.http.post(this.configUrl + functionName, data)
  }
  getAll(functionName:any){
    return this.http.get(this.configUrl + functionName)
  }

  getOne(functionName:any, data:any){
    return this.http.get(this.configUrl + `${functionName}/${data}`)
  }

  delete(functionName:any, id: number) {
    return this.http.delete(this.configUrl +`${functionName}/${id}`);
  }
  
  update(functionName:any, id: number,data:any) {
    return this.http.put(this.configUrl +`${functionName}/${id}` , data);
  }

}
